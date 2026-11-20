#include <windows.h>
#include <windowsx.h>
#include <d3d11.h>
#include <dwmapi.h>
#include <gdiplus.h>
#include <d3dcompiler.h>
#include <dxgi1_6.h>
#include <wrl/client.h>

#include <winrt/base.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <iostream>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

using Microsoft::WRL::ComPtr;
using namespace winrt;
using namespace winrt::Windows::Graphics;
using namespace winrt::Windows::Graphics::Capture;
using namespace winrt::Windows::Graphics::DirectX;
using namespace winrt::Windows::Graphics::DirectX::Direct3D11;

namespace {

std::atomic<bool> g_stopRequested{false};
constexpr int kToastWidth = 640;
constexpr int kToastHeight = 108;
constexpr UINT_PTR kToastTimer = 1;

const char* kShaderSource = R"(
Texture2D<float4> tex : register(t0);
SamplerState samp : register(s0);

struct VSOut {
  float4 pos : SV_POSITION;
  float2 uv : TEXCOORD0;
};

VSOut VSMain(uint id : SV_VertexID) {
  float2 p = float2((id << 1) & 2, id & 2);
  VSOut result;
  result.pos = float4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  result.uv = p;
  return result;
}

float4 CubicWeights(float t) {
  float t2 = t * t;
  float t3 = t2 * t;
  return float4(
    -0.5 * t3 + t2 - 0.5 * t,
     1.5 * t3 - 2.5 * t2 + 1.0,
    -1.5 * t3 + 2.0 * t2 + 0.5 * t,
     0.5 * t3 - 0.5 * t2);
}

float4 PSMain(VSOut input) : SV_TARGET {
  uint width, height;
  tex.GetDimensions(width, height);
  float2 size = float2(width, height);
  float2 coord = input.uv * size - 0.5;
  float2 base = floor(coord);
  float2 fraction = coord - base;
  float4 wx = CubicWeights(fraction.x);
  float4 wy = CubicWeights(fraction.y);
  float4 color = 0;
  [unroll] for (int y = -1; y <= 2; ++y) {
    [unroll] for (int x = -1; x <= 2; ++x) {
      float2 samplePos = (base + float2(x, y) + 0.5) / size;
      color += tex.SampleLevel(samp, samplePos, 0) * wx[x + 1] * wy[y + 1];
    }
  }
  return color;
}
)";

std::string ToUtf8(const std::wstring& value) {
  if (value.empty()) return {};
  const int size = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()),
                                       nullptr, 0, nullptr, nullptr);
  std::string result(static_cast<size_t>(size), '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), result.data(),
                      size, nullptr, nullptr);
  return result;
}

std::string JsonEscape(const std::string& value) {
  std::string result;
  result.reserve(value.size() + 8);
  for (const unsigned char c : value) {
    switch (c) {
      case '"': result += "\\\""; break;
      case '\\': result += "\\\\"; break;
      case '\n': result += "\\n"; break;
      case '\r': result += "\\r"; break;
      case '\t': result += "\\t"; break;
      default:
        if (c < 0x20) {
          char buffer[8];
          sprintf_s(buffer, "\\u%04x", c);
          result += buffer;
        } else {
          result += static_cast<char>(c);
        }
    }
  }
  return result;
}

std::wstring ProcessPath(HWND hwnd) {
  DWORD pid = 0;
  GetWindowThreadProcessId(hwnd, &pid);
  if (!pid) return {};
  HANDLE process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!process) return {};
  wchar_t buffer[MAX_PATH * 4]{};
  DWORD size = static_cast<DWORD>(std::size(buffer));
  std::wstring result;
  if (QueryFullProcessImageNameW(process, 0, buffer, &size)) result.assign(buffer, size);
  CloseHandle(process);
  return result;
}

std::wstring FileName(const std::wstring& path) {
  const size_t slash = path.find_last_of(L"\\/");
  return slash == std::wstring::npos ? path : path.substr(slash + 1);
}

struct WindowInfo {
  HWND handle{};
  std::wstring title;
  std::wstring process;
  RECT rect{};
  RECT monitor{};
};

BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lparam) {
  auto* windows = reinterpret_cast<std::vector<WindowInfo>*>(lparam);
  if (!IsWindowVisible(hwnd)) return TRUE;
  const int length = GetWindowTextLengthW(hwnd);
  if (length <= 0) return TRUE;
  std::wstring title(static_cast<size_t>(length) + 1, L'\0');
  GetWindowTextW(hwnd, title.data(), length + 1);
  title.resize(static_cast<size_t>(GetWindowTextLengthW(hwnd)));
  if (title.empty()) return TRUE;
  RECT rect{};
  if (!GetWindowRect(hwnd, &rect)) return TRUE;
  if (rect.right - rect.left < 64 || rect.bottom - rect.top < 64) return TRUE;
  RECT monitor{};
  const HMONITOR monitorHandle = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
  MONITORINFO info{sizeof(MONITORINFO)};
  if (GetMonitorInfoW(monitorHandle, &info)) monitor = info.rcMonitor;
  windows->push_back({hwnd, title, FileName(ProcessPath(hwnd)), rect, monitor});
  return TRUE;
}

std::vector<WindowInfo> ListWindows() {
  std::vector<WindowInfo> windows;
  EnumWindows(EnumWindowsProc, reinterpret_cast<LPARAM>(&windows));
  return windows;
}

int GetEncoderClsid(const WCHAR* mime, CLSID* clsid) {
  UINT count = 0;
  UINT size = 0;
  Gdiplus::GetImageEncodersSize(&count, &size);
  if (!size) return -1;
  std::vector<BYTE> buffer(size);
  auto* codecs = reinterpret_cast<Gdiplus::ImageCodecInfo*>(buffer.data());
  Gdiplus::GetImageEncoders(count, size, codecs);
  for (UINT i = 0; i < count; ++i) {
    if (wcscmp(codecs[i].MimeType, mime) == 0) {
      *clsid = codecs[i].Clsid;
      return static_cast<int>(i);
    }
  }
  return -1;
}

bool SaveWindowSnapshot(HWND target, const std::wstring& path) {
  RECT client{};
  if (!GetClientRect(target, &client)) return false;
  const int width = client.right - client.left;
  const int height = client.bottom - client.top;
  if (width <= 0 || height <= 0) return false;

  BITMAPINFO info{};
  info.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  info.bmiHeader.biWidth = width;
  info.bmiHeader.biHeight = -height;
  info.bmiHeader.biPlanes = 1;
  info.bmiHeader.biBitCount = 32;
  info.bmiHeader.biCompression = BI_RGB;

  void* bits = nullptr;
  const HDC screen = GetDC(nullptr);
  const HDC memory = CreateCompatibleDC(screen);
  const HBITMAP bitmap =
      CreateDIBSection(screen, &info, DIB_RGB_COLORS, &bits, nullptr, 0);
  if (!bitmap || !bits) {
    DeleteDC(memory);
    ReleaseDC(nullptr, screen);
    if (bitmap) DeleteObject(bitmap);
    return false;
  }
  const HGDIOBJ previous = SelectObject(memory, bitmap);
  const BOOL printed = PrintWindow(target, memory, 3);
  SelectObject(memory, previous);
  DeleteDC(memory);
  ReleaseDC(nullptr, screen);
  if (!printed) {
    DeleteObject(bitmap);
    return false;
  }

  auto* pixels = static_cast<uint32_t*>(bits);
  const size_t count = static_cast<size_t>(width) * static_cast<size_t>(height);
  for (size_t i = 0; i < count; ++i) pixels[i] |= 0xFF000000u;

  CLSID png{};
  bool saved = false;
  if (GetEncoderClsid(L"image/png", &png) >= 0) {
    Gdiplus::Bitmap image(bitmap, nullptr);
    saved = image.Save(path.c_str(), &png, nullptr) == Gdiplus::Ok;
  }
  DeleteObject(bitmap);
  return saved;
}

struct CaptureState {
  std::mutex mutex;
  std::atomic<bool> running{true};
  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  ComPtr<IDXGISwapChain1> swapchain;
  ComPtr<IDXGISwapChain3> swapchain3;
  ComPtr<ID3D11Texture2D> captureTexture;
  ComPtr<ID3D11ShaderResourceView> captureView;
  ComPtr<ID3D11SamplerState> sampler;
  ComPtr<ID3D11VertexShader> vertexShader;
  ComPtr<ID3D11PixelShader> pixelShader;
  ComPtr<ID3D11RenderTargetView> renderTargets[2];
  HWND overlay{};
  HWND toast{};
  HFONT toastTitleFont{};
  HFONT toastSubFont{};
  HWND target{};
  UINT outputWidth{};
  UINT outputHeight{};
  UINT sourceWidth{};
  UINT sourceHeight{};
  UINT clientOffsetX{};
  UINT clientOffsetY{};
  int cropX{};
  int cropY{};
  int monitorX{};
  int monitorY{};
  float viewportX{};
  float viewportY{};
  float viewportWidth{};
  float viewportHeight{};
  bool leftDown{};
  bool rightDown{};
  bool middleDown{};
  bool visible{true};
};

CaptureState* g_state = nullptr;

struct InputRoute {
  HWND window{};
  POINT point{};
};

InputRoute ResolveInputRoute(HWND target, int x, int y) {
  InputRoute route{target, {x, y}};
  for (int depth = 0; depth < 8; ++depth) {
    const HWND child = ChildWindowFromPointEx(
        route.window, route.point,
        CWP_SKIPINVISIBLE | CWP_SKIPDISABLED | CWP_SKIPTRANSPARENT);
    if (!child || child == route.window) break;
    MapWindowPoints(route.window, child, &route.point, 1);
    route.window = child;
  }
  return route;
}

void ForwardMouse(CaptureState& state, UINT message, WPARAM wparam, LPARAM lparam) {
  if (!state.target || state.viewportWidth <= 0 || state.viewportHeight <= 0) return;
  if (message == WM_MOUSEWHEEL || message == WM_MOUSEHWHEEL) {
    const POINT screen{GET_X_LPARAM(lparam), GET_Y_LPARAM(lparam)};
    const int viewportLeft = static_cast<int>(state.viewportX);
    const int viewportTop = static_cast<int>(state.viewportY);
    const int viewportRight = viewportLeft + static_cast<int>(state.viewportWidth);
    const int viewportBottom = viewportTop + static_cast<int>(state.viewportHeight);
    if (screen.x < viewportLeft || screen.x >= viewportRight || screen.y < viewportTop ||
        screen.y >= viewportBottom)
      return;
    POINT targetClient = screen;
    ScreenToClient(state.target, &targetClient);
    const InputRoute route = ResolveInputRoute(state.target, targetClient.x, targetClient.y);
    SetForegroundWindow(state.target);
    PostMessageW(route.window, message, wparam, lparam);
    return;
  }
  int x = GET_X_LPARAM(lparam);
  int y = GET_Y_LPARAM(lparam);
  const bool isDown = message == WM_LBUTTONDOWN || message == WM_RBUTTONDOWN ||
                      message == WM_MBUTTONDOWN || message == WM_LBUTTONDBLCLK ||
                      message == WM_RBUTTONDBLCLK || message == WM_MBUTTONDBLCLK;
  const bool isUp = message == WM_LBUTTONUP || message == WM_RBUTTONUP ||
                    message == WM_MBUTTONUP;
  const bool dragging = state.leftDown || state.rightDown || state.middleDown;
  const bool inside = x >= state.viewportX && x < state.viewportX + state.viewportWidth &&
                      y >= state.viewportY && y < state.viewportY + state.viewportHeight;
  if (!inside) {
    if (isDown) return;
    if (!isUp && !dragging) return;
  }
  if (message == WM_LBUTTONDOWN || message == WM_LBUTTONDBLCLK) state.leftDown = true;
  if (message == WM_RBUTTONDOWN || message == WM_RBUTTONDBLCLK) state.rightDown = true;
  if (message == WM_MBUTTONDOWN || message == WM_MBUTTONDBLCLK) state.middleDown = true;
  if (message == WM_LBUTTONUP) state.leftDown = false;
  if (message == WM_RBUTTONUP) state.rightDown = false;
  if (message == WM_MBUTTONUP) state.middleDown = false;
  x = std::clamp(x, static_cast<int>(state.viewportX),
                 static_cast<int>(state.viewportX + state.viewportWidth) - 1);
  y = std::clamp(y, static_cast<int>(state.viewportY),
                 static_cast<int>(state.viewportY + state.viewportHeight) - 1);
  const int sourceX = std::clamp(
      static_cast<int>((static_cast<float>(x) - state.viewportX) / state.viewportWidth *
                       state.sourceWidth),
      0, static_cast<int>(state.sourceWidth) - 1);
  const int sourceY = std::clamp(
      static_cast<int>((static_cast<float>(y) - state.viewportY) / state.viewportHeight *
                       state.sourceHeight),
      0, static_cast<int>(state.sourceHeight) - 1);
  const InputRoute route =
      ResolveInputRoute(state.target, state.cropX + sourceX, state.cropY + sourceY);
  const LPARAM client = MAKELPARAM(route.point.x, route.point.y);
  if (isDown) SetForegroundWindow(state.target);
  PostMessageW(route.window, message, wparam, client);
}

LRESULT CALLBACK ToastProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  switch (message) {
    case WM_ERASEBKGND:
      return 1;
    case WM_NCHITTEST:
      return HTTRANSPARENT;
    case WM_TIMER:
      if (wparam == kToastTimer) {
        KillTimer(hwnd, kToastTimer);
        ShowWindow(hwnd, SW_HIDE);
      }
      return 0;
    case WM_PAINT: {
      PAINTSTRUCT ps{};
      const HDC dc = BeginPaint(hwnd, &ps);
      RECT rc{};
      GetClientRect(hwnd, &rc);
      const bool on = g_state && g_state->visible;
      HBRUSH background = CreateSolidBrush(RGB(16, 21, 32));
      FillRect(dc, &rc, background);
      DeleteObject(background);
      RECT accent{0, 0, 7, rc.bottom};
      HBRUSH accentBrush = CreateSolidBrush(on ? RGB(247, 127, 51) : RGB(120, 130, 148));
      FillRect(dc, &accent, accentBrush);
      DeleteObject(accentBrush);
      if (g_state) {
        SetBkMode(dc, TRANSPARENT);
        SetTextColor(dc, on ? RGB(247, 127, 51) : RGB(200, 206, 218));
        SelectObject(dc, g_state->toastTitleFont);
        RECT title{26, 12, rc.right - 18, 60};
        DrawTextW(dc, on ? L"画质增强：已开启" : L"画质增强：已关闭 · 原画面", -1, &title,
                  DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
        SetTextColor(dc, RGB(150, 160, 178));
        SelectObject(dc, g_state->toastSubFont);
        RECT sub{26, 60, rc.right - 18, rc.bottom - 8};
        DrawTextW(dc, L"Ctrl+Alt+G 切换 · Ctrl+Alt+Shift+E 停止", -1, &sub,
                  DT_LEFT | DT_SINGLELINE | DT_VCENTER | DT_END_ELLIPSIS);
      }
      EndPaint(hwnd, &ps);
      return 0;
    }
    default:
      return DefWindowProcW(hwnd, message, wparam, lparam);
  }
}

void ShowToast(CaptureState& state) {
  if (!state.toast) return;
  const int x = state.monitorX + (static_cast<int>(state.outputWidth) - kToastWidth) / 2;
  const int y = state.monitorY + 72;
  SetWindowPos(state.toast, HWND_TOPMOST, x, y, kToastWidth, kToastHeight,
               SWP_NOACTIVATE | SWP_SHOWWINDOW);
  ShowWindow(state.toast, SW_SHOWNOACTIVATE);
  InvalidateRect(state.toast, nullptr, TRUE);
  UpdateWindow(state.toast);
  SetTimer(state.toast, kToastTimer, 1800, nullptr);
}

void BringTargetToFront(HWND target) {
  if (!IsWindow(target)) return;
  const HWND foreground = GetForegroundWindow();
  const DWORD foregroundThread =
      foreground ? GetWindowThreadProcessId(foreground, nullptr) : 0;
  const DWORD currentThread = GetCurrentThreadId();
  const bool attached = foregroundThread && foregroundThread != currentThread &&
                        AttachThreadInput(currentThread, foregroundThread, TRUE);
  SetForegroundWindow(target);
  BringWindowToTop(target);
  SetWindowPos(target, HWND_TOP, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
  if (attached) AttachThreadInput(currentThread, foregroundThread, FALSE);
}

void SetOverlayVisible(CaptureState& state, bool visible) {
  if (!state.overlay || state.visible == visible) return;
  if (visible) {
    ShowWindow(state.overlay, SW_SHOWNOACTIVATE);
    SetWindowPos(state.overlay, HWND_TOPMOST, state.monitorX, state.monitorY,
                 static_cast<int>(state.outputWidth), static_cast<int>(state.outputHeight),
                 SWP_SHOWWINDOW | SWP_NOACTIVATE);
    if (IsWindow(state.target)) SetForegroundWindow(state.target);
  } else {
    ShowWindow(state.overlay, SW_HIDE);
    BringTargetToFront(state.target);
  }
  state.visible = visible;
  std::cerr << "state visible=" << (visible ? 1 : 0) << "\n";
  ShowToast(state);
}

LRESULT CALLBACK OverlayProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam) {
  if (message == WM_APP + 1) {
    if (g_state) SetOverlayVisible(*g_state, !g_state->visible);
    return 0;
  }
  if (message == WM_APP + 2) {
    g_stopRequested = true;
    return 0;
  }
  if (g_state && (message == WM_MOUSEMOVE || message == WM_LBUTTONDOWN ||
                  message == WM_LBUTTONUP || message == WM_LBUTTONDBLCLK ||
                  message == WM_RBUTTONDOWN || message == WM_RBUTTONUP ||
                  message == WM_RBUTTONDBLCLK || message == WM_MBUTTONDOWN ||
                  message == WM_MBUTTONUP || message == WM_MOUSEWHEEL ||
                  message == WM_MOUSEHWHEEL)) {
    ForwardMouse(*g_state, message, wparam, lparam);
    return 0;
  }
  return DefWindowProcW(hwnd, message, wparam, lparam);
}

void UpdateViewport(CaptureState& state) {
  const float sourceAspect = static_cast<float>(state.sourceWidth) / state.sourceHeight;
  const float outputAspect = static_cast<float>(state.outputWidth) / state.outputHeight;
  if (sourceAspect > outputAspect) {
    state.viewportX = 0;
    state.viewportWidth = static_cast<float>(state.outputWidth);
    state.viewportHeight = state.viewportWidth / sourceAspect;
    state.viewportY = (static_cast<float>(state.outputHeight) - state.viewportHeight) * 0.5f;
  } else {
    state.viewportY = 0;
    state.viewportHeight = static_cast<float>(state.outputHeight);
    state.viewportWidth = state.viewportHeight * sourceAspect;
    state.viewportX = (static_cast<float>(state.outputWidth) - state.viewportWidth) * 0.5f;
  }
}

bool CreateShaderResources(CaptureState& state) {
  ComPtr<ID3DBlob> vertexBlob;
  ComPtr<ID3DBlob> pixelBlob;
  ComPtr<ID3DBlob> error;
  HRESULT result = D3DCompile(kShaderSource, strlen(kShaderSource), nullptr, nullptr, nullptr,
                              "VSMain", "vs_5_0", D3DCOMPILE_OPTIMIZATION_LEVEL3, 0, &vertexBlob,
                              &error);
  if (FAILED(result)) {
    if (error) std::cerr << static_cast<const char*>(error->GetBufferPointer()) << "\n";
    return false;
  }
  result = D3DCompile(kShaderSource, strlen(kShaderSource), nullptr, nullptr, nullptr, "PSMain",
                      "ps_5_0", D3DCOMPILE_OPTIMIZATION_LEVEL3, 0, &pixelBlob, &error);
  if (FAILED(result)) {
    if (error) std::cerr << static_cast<const char*>(error->GetBufferPointer()) << "\n";
    return false;
  }
  if (FAILED(state.device->CreateVertexShader(vertexBlob->GetBufferPointer(),
                                              vertexBlob->GetBufferSize(), nullptr,
                                              &state.vertexShader)))
    return false;
  if (FAILED(state.device->CreatePixelShader(pixelBlob->GetBufferPointer(),
                                             pixelBlob->GetBufferSize(), nullptr,
                                             &state.pixelShader)))
    return false;
  D3D11_SAMPLER_DESC samplerDesc{};
  samplerDesc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
  samplerDesc.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
  samplerDesc.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
  samplerDesc.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
  samplerDesc.MaxAnisotropy = 1;
  samplerDesc.ComparisonFunc = D3D11_COMPARISON_NEVER;
  samplerDesc.MaxLOD = D3D11_FLOAT32_MAX;
  return SUCCEEDED(state.device->CreateSamplerState(&samplerDesc, &state.sampler));
}

bool CreateCaptureTexture(CaptureState& state, UINT width, UINT height) {
  state.sourceWidth = width;
  state.sourceHeight = height;
  D3D11_TEXTURE2D_DESC description{};
  description.Width = width;
  description.Height = height;
  description.MipLevels = 1;
  description.ArraySize = 1;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.Usage = D3D11_USAGE_DEFAULT;
  description.BindFlags = D3D11_BIND_SHADER_RESOURCE;
  if (FAILED(state.device->CreateTexture2D(&description, nullptr, &state.captureTexture)))
    return false;
  D3D11_SHADER_RESOURCE_VIEW_DESC viewDesc{};
  viewDesc.Format = description.Format;
  viewDesc.ViewDimension = D3D11_SRV_DIMENSION_TEXTURE2D;
  viewDesc.Texture2D.MipLevels = 1;
  return SUCCEEDED(state.device->CreateShaderResourceView(state.captureTexture.Get(), &viewDesc,
                                                          &state.captureView));
}

bool CreateRenderTargets(CaptureState& state) {
  ComPtr<ID3D11Texture2D> buffer;
  const HRESULT getResult = state.swapchain->GetBuffer(0, IID_PPV_ARGS(&buffer));
  if (FAILED(getResult)) {
    std::cerr << "GetBuffer(0) failed: " << std::hex << getResult << "\n";
    return false;
  }
  const HRESULT viewResult =
      state.device->CreateRenderTargetView(buffer.Get(), nullptr, &state.renderTargets[0]);
  if (FAILED(viewResult)) {
    std::cerr << "CreateRenderTargetView(0) failed: " << std::hex << viewResult << "\n";
    return false;
  }
  return true;
}

void Render(CaptureState& state) {
  const float black[4] = {0, 0, 0, 1};
  state.context->OMSetRenderTargets(1, state.renderTargets[0].GetAddressOf(), nullptr);
  state.context->ClearRenderTargetView(state.renderTargets[0].Get(), black);

  D3D11_VIEWPORT viewport{};
  viewport.TopLeftX = state.viewportX;
  viewport.TopLeftY = state.viewportY;
  viewport.Width = state.viewportWidth;
  viewport.Height = state.viewportHeight;
  viewport.MinDepth = 0;
  viewport.MaxDepth = 1;
  state.context->RSSetViewports(1, &viewport);
  state.context->IASetInputLayout(nullptr);
  state.context->IASetPrimitiveTopology(D3D_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
  state.context->VSSetShader(state.vertexShader.Get(), nullptr, 0);
  state.context->PSSetShader(state.pixelShader.Get(), nullptr, 0);
  state.context->PSSetShaderResources(0, 1, state.captureView.GetAddressOf());
  state.context->PSSetSamplers(0, 1, state.sampler.GetAddressOf());
  state.context->Draw(3, 0);
  state.swapchain->Present(1, 0);
}

int CaptureWindow(HWND target, int seconds, RECT crop, bool hasCrop) {
  RECT client{};
  if (!GetClientRect(target, &client)) {
    std::cerr << "GetClientRect failed\n";
    return 1;
  }
  POINT origin{0, 0};
  if (!ClientToScreen(target, &origin)) {
    std::cerr << "ClientToScreen failed\n";
    return 1;
  }
  const int clientWidth = client.right - client.left;
  const int clientHeight = client.bottom - client.top;
  if (clientWidth <= 0 || clientHeight <= 0) {
    std::cerr << "empty client area\n";
    return 1;
  }
  RECT region{0, 0, clientWidth, clientHeight};
  if (hasCrop) {
    region.left = std::clamp(static_cast<int>(crop.left), 0, clientWidth - 1);
    region.top = std::clamp(static_cast<int>(crop.top), 0, clientHeight - 1);
    region.right =
        std::clamp(static_cast<int>(crop.right), static_cast<int>(region.left) + 1, clientWidth);
    region.bottom =
        std::clamp(static_cast<int>(crop.bottom), static_cast<int>(region.top) + 1, clientHeight);
    if (region.right - region.left < 16 || region.bottom - region.top < 16) {
      std::cerr << "invalid crop region\n";
      return 1;
    }
  }
  const UINT sourceWidth = static_cast<UINT>(region.right - region.left);
  const UINT sourceHeight = static_cast<UINT>(region.bottom - region.top);
  RECT frame{};
  if (FAILED(DwmGetWindowAttribute(target, DWMWA_EXTENDED_FRAME_BOUNDS, &frame, sizeof(frame))) ||
      frame.right <= frame.left || frame.bottom <= frame.top) {
    if (!GetWindowRect(target, &frame)) {
      std::cerr << "GetWindowRect failed\n";
      return 1;
    }
  }
  const int clientOffsetX = origin.x - frame.left + region.left;
  const int clientOffsetY = origin.y - frame.top + region.top;
  if (clientOffsetX < 0 || clientOffsetY < 0 ||
      clientOffsetX + static_cast<int>(sourceWidth) > frame.right - frame.left ||
      clientOffsetY + static_cast<int>(sourceHeight) > frame.bottom - frame.top) {
    std::cerr << "client area is outside captured window frame\n";
    return 1;
  }
  const HMONITOR monitorHandle = MonitorFromWindow(target, MONITOR_DEFAULTTONEAREST);
  MONITORINFO monitorInfo{sizeof(MONITORINFO)};
  if (!GetMonitorInfoW(monitorHandle, &monitorInfo)) {
    std::cerr << "GetMonitorInfo failed\n";
    return 1;
  }
  const RECT monitor = monitorInfo.rcMonitor;

  winrt::init_apartment(winrt::apartment_type::multi_threaded);

  CaptureState state;
  state.target = target;
  state.clientOffsetX = static_cast<UINT>(clientOffsetX);
  state.clientOffsetY = static_cast<UINT>(clientOffsetY);
  state.cropX = region.left;
  state.cropY = region.top;
  state.monitorX = monitor.left;
  state.monitorY = monitor.top;
  state.outputWidth = static_cast<UINT>(monitor.right - monitor.left);
  state.outputHeight = static_cast<UINT>(monitor.bottom - monitor.top);
  D3D_FEATURE_LEVEL level{};
  const HRESULT create = D3D11CreateDevice(
      nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0,
      D3D11_SDK_VERSION, state.device.ReleaseAndGetAddressOf(), &level,
      state.context.ReleaseAndGetAddressOf());
  if (FAILED(create)) {
    std::cerr << "D3D11CreateDevice failed: " << std::hex << create << "\n";
    return 1;
  }
  if (!CreateShaderResources(state) || !CreateCaptureTexture(state, sourceWidth, sourceHeight)) {
    std::cerr << "shader/texture initialization failed\n";
    return 1;
  }
  UpdateViewport(state);

  ComPtr<IDXGIDevice> dxgiDevice;
  state.device.As(&dxgiDevice);
  winrt::com_ptr<IInspectable> inspectable;
  check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice.Get(), inspectable.put()));
  const IDirect3DDevice winrtDevice = inspectable.as<IDirect3DDevice>();

  const auto interop =
      winrt::get_activation_factory<GraphicsCaptureItem, ::IGraphicsCaptureItemInterop>();
  GraphicsCaptureItem item{nullptr};
  check_hresult(interop->CreateForWindow(target, winrt::guid_of<GraphicsCaptureItem>(),
                                         winrt::put_abi(item)));
  std::cerr << "capture frame " << item.Size().Width << "x" << item.Size().Height << ", crop "
            << region.left << "," << region.top << " " << sourceWidth << "x" << sourceHeight
            << ", frame offset " << frame.left << "," << frame.top << ", client offset "
            << clientOffsetX << "," << clientOffsetY << "\n";

  const HINSTANCE instance = GetModuleHandleW(nullptr);
  WNDCLASSEXW windowClass{sizeof(WNDCLASSEXW)};
  windowClass.style = CS_HREDRAW | CS_VREDRAW | CS_DBLCLKS;
  windowClass.lpfnWndProc = OverlayProc;
  windowClass.hInstance = instance;
  windowClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  windowClass.lpszClassName = L"ScreenToolsEnhanceOverlay";
  RegisterClassExW(&windowClass);

  WNDCLASSEXW toastClass{sizeof(WNDCLASSEXW)};
  toastClass.lpfnWndProc = ToastProc;
  toastClass.hInstance = instance;
  toastClass.hCursor = LoadCursorW(nullptr, IDC_ARROW);
  toastClass.lpszClassName = L"ScreenToolsEnhanceToast";
  RegisterClassExW(&toastClass);

  const DWORD exStyle = WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
  state.overlay =
      CreateWindowExW(exStyle, windowClass.lpszClassName, L"ScreenTools Enhance", WS_POPUP,
                      monitor.left, monitor.top, static_cast<int>(state.outputWidth),
                      static_cast<int>(state.outputHeight), nullptr, nullptr, instance, nullptr);
  if (!state.overlay) {
    std::cerr << "CreateWindowExW failed: " << GetLastError() << "\n";
    return 1;
  }
  g_state = &state;
  ShowWindow(state.overlay, SW_SHOWNOACTIVATE);
  SetWindowPos(state.overlay, HWND_TOPMOST, monitor.left, monitor.top,
               static_cast<int>(state.outputWidth), static_cast<int>(state.outputHeight),
               SWP_SHOWWINDOW);

  state.toast = CreateWindowExW(
      WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE | WS_EX_LAYERED | WS_EX_TRANSPARENT,
      toastClass.lpszClassName, L"ScreenTools Enhance Toast", WS_POPUP, 0, 0, kToastWidth,
      kToastHeight, nullptr, nullptr, instance, nullptr);
  if (state.toast) {
    SetLayeredWindowAttributes(state.toast, 0, 240, LWA_ALPHA);
    HRGN region = CreateRoundRectRgn(0, 0, kToastWidth + 1, kToastHeight + 1, 20, 20);
    SetWindowRgn(state.toast, region, TRUE);
  }
  state.toastTitleFont =
      CreateFontW(-34, 0, 0, 0, FW_BOLD, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                  OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH,
                  L"Microsoft YaHei UI");
  state.toastSubFont =
      CreateFontW(-18, 0, 0, 0, FW_NORMAL, FALSE, FALSE, FALSE, DEFAULT_CHARSET,
                  OUT_DEFAULT_PRECIS, CLIP_DEFAULT_PRECIS, CLEARTYPE_QUALITY, DEFAULT_PITCH,
                  L"Microsoft YaHei UI");

  SetForegroundWindow(target);
  std::cerr << "overlay hwnd=" << reinterpret_cast<uintptr_t>(state.overlay) << "\n";
  std::cerr << "state visible=1\n";
  ShowToast(state);

  ComPtr<IDXGIFactory2> factory;
  CreateDXGIFactory1(IID_PPV_ARGS(&factory));
  DXGI_SWAP_CHAIN_DESC1 description{};
  description.Width = state.outputWidth;
  description.Height = state.outputHeight;
  description.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
  description.SampleDesc.Count = 1;
  description.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
  description.BufferCount = 1;
  description.Scaling = DXGI_SCALING_STRETCH;
  description.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;
  description.AlphaMode = DXGI_ALPHA_MODE_IGNORE;
  if (FAILED(factory->CreateSwapChainForHwnd(state.device.Get(), state.overlay, &description,
                                             nullptr, nullptr,
                                             state.swapchain.ReleaseAndGetAddressOf()))) {
    std::cerr << "CreateSwapChainForHwnd failed\n";
    return 1;
  }
  if (!CreateRenderTargets(state)) {
    std::cerr << "CreateRenderTargets failed\n";
    return 1;
  }

  auto pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
      winrtDevice, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, item.Size());
  auto session = pool.CreateCaptureSession(item);
  session.IsCursorCaptureEnabled(false);
  try {
    session.IsBorderRequired(false);
  } catch (...) {
  }

  const auto token = pool.FrameArrived(
      [&state](const Direct3D11CaptureFramePool& sender,
               const winrt::Windows::Foundation::IInspectable&) {
        if (!state.running.load()) return;
        const auto frame = sender.TryGetNextFrame();
        if (!frame) return;
        try {
          const auto access = frame.Surface().as<
              ::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
          winrt::com_ptr<ID3D11Texture2D> texture;
          check_hresult(access->GetInterface(IID_PPV_ARGS(texture.put())));
          D3D11_TEXTURE2D_DESC sourceDesc{};
          texture->GetDesc(&sourceDesc);
          if (sourceDesc.Width < state.clientOffsetX + state.sourceWidth ||
              sourceDesc.Height < state.clientOffsetY + state.sourceHeight)
            return;
          const D3D11_BOX box{state.clientOffsetX, state.clientOffsetY, 0,
                              state.clientOffsetX + state.sourceWidth,
                              state.clientOffsetY + state.sourceHeight, 1};
          std::lock_guard lock(state.mutex);
          state.context->CopySubresourceRegion(state.captureTexture.Get(), 0, 0, 0, 0,
                                               texture.get(), 0, &box);
          Render(state);
        } catch (...) {
        }
      });

  session.StartCapture();
  std::cerr << "capturing " << sourceWidth << "x" << sourceHeight << " -> " << state.outputWidth
            << "x" << state.outputHeight << " for " << seconds << "s\n";

  const auto start = std::chrono::steady_clock::now();
  MSG message{};
  while (std::chrono::steady_clock::now() - start < std::chrono::seconds(seconds)) {
    while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
      TranslateMessage(&message);
      DispatchMessageW(&message);
    }
    if (g_stopRequested.load() || !IsWindow(state.target) || IsIconic(state.target)) break;
    Sleep(10);
  }

  state.running = false;
  pool.FrameArrived(token);
  session.Close();
  pool.Close();
  Sleep(100);
  if (state.toast) DestroyWindow(state.toast);
  if (state.toastTitleFont) DeleteObject(state.toastTitleFont);
  if (state.toastSubFont) DeleteObject(state.toastSubFont);
  g_state = nullptr;
  DestroyWindow(state.overlay);
  return 0;
}

}  // namespace

int wmain(int argc, wchar_t** argv) {
  SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
  if (argc >= 2 && std::wstring(argv[1]) == L"--list") {
    for (const auto& window : ListWindows()) {
      std::cout << "{\"hwnd\":" << reinterpret_cast<uintptr_t>(window.handle)
                << ",\"title\":\"" << JsonEscape(ToUtf8(window.title)) << "\""
                << ",\"process\":\"" << JsonEscape(ToUtf8(window.process)) << "\""
                << ",\"rect\":[" << window.rect.left << "," << window.rect.top << ","
                << window.rect.right << "," << window.rect.bottom << "]"
                << ",\"monitor\":[" << window.monitor.left << "," << window.monitor.top << ","
                << window.monitor.right << "," << window.monitor.bottom << "]}\n";
    }
    return 0;
  }
  if (argc >= 4 && std::wstring(argv[1]) == L"--snapshot") {
    const auto handle = static_cast<HWND>(
        reinterpret_cast<void*>(static_cast<uintptr_t>(std::stoull(argv[2], nullptr, 0))));
    if (!IsWindow(handle)) {
      std::cerr << "invalid hwnd\n";
      return 1;
    }
    Gdiplus::GdiplusStartupInput input;
    ULONG_PTR token = 0;
    if (Gdiplus::GdiplusStartup(&token, &input, nullptr) != Gdiplus::Ok) {
      std::cerr << "GDI+ startup failed\n";
      return 1;
    }
    const bool saved = SaveWindowSnapshot(handle, argv[3]);
    Gdiplus::GdiplusShutdown(token);
    return saved ? 0 : 1;
  }
  if (argc >= 3 && std::wstring(argv[1]) == L"--capture") {
    const auto handle = static_cast<HWND>(
        reinterpret_cast<void*>(static_cast<uintptr_t>(std::stoull(argv[2], nullptr, 0))));
    if (!IsWindow(handle)) {
      std::cerr << "invalid hwnd\n";
      return 1;
    }
    int seconds = 3600;
    RECT crop{};
    bool hasCrop = false;
    try {
      for (int i = 3; i < argc; ++i) {
        const std::wstring arg = argv[i];
        if (arg == L"--crop" && i + 4 < argc) {
          crop.left = std::stoi(argv[i + 1]);
          crop.top = std::stoi(argv[i + 2]);
          crop.right = crop.left + std::stoi(argv[i + 3]);
          crop.bottom = crop.top + std::stoi(argv[i + 4]);
          hasCrop = true;
          i += 4;
        } else {
          seconds = std::stoi(arg);
        }
      }
    } catch (...) {
      std::cerr << "invalid arguments\n";
      return 2;
    }
    try {
      return CaptureWindow(handle, seconds, crop, hasCrop);
    } catch (const winrt::hresult_error& error) {
      std::cerr << "capture failed: " << winrt::to_string(error.message()) << " (0x" << std::hex
                << error.code() << ")\n";
      return 1;
    } catch (const std::exception& error) {
      std::cerr << "capture failed: " << error.what() << "\n";
      return 1;
    }
  }
  std::cerr << "usage: enhance-worker --list | --capture <hwnd> [seconds] [--crop x y w h] | "
               "--snapshot <hwnd> <path>\n";
  return 2;
}
