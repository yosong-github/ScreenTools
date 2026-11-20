cmake_minimum_required(VERSION 3.20)
project(enhance-worker LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_executable(enhance-worker src/main.cpp)

if (MSVC)
  set_property(TARGET enhance-worker PROPERTY MSVC_RUNTIME_LIBRARY
    "MultiThreaded$<$<CONFIG:Debug>:Debug>")
  target_compile_options(enhance-worker PRIVATE /utf-8)
endif()

target_compile_definitions(enhance-worker PRIVATE
  UNICODE
  _UNICODE
  NOMINMAX
  WIN32_LEAN_AND_MEAN
)

target_link_libraries(enhance-worker PRIVATE
  d3d11
  d3dcompiler
  dxgi
  dwmapi
  gdiplus
  windowsapp
  user32
  gdi32
  ole32
  shcore
)
