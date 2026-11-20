// FSR 1.0 EASU + RCAS shader logic adapted from AMD FidelityFX FSR1.
// Copyright (c) 2021 Advanced Micro Devices, Inc.
// MIT License; see LICENSES/FSR1.txt in this directory.
#pragma once

inline constexpr const char* kFsrShaderSource = R"(
cbuffer FsrParams : register(b0)
{
  uint4 con0;
  uint4 con1;
  uint4 con2;
  uint4 con3;
  uint4 rcas;
  int2 viewportOffset;
  int2 outputSize;
};

Texture2D<float4> sourceTex : register(t0);
SamplerState sourceSampler : register(s0);

struct PSIn
{
  float4 pos : SV_POSITION;
};

PSIn VSMain(uint id : SV_VertexID)
{
  float2 p = float2((id << 1) & 2, id & 2);
  PSIn output;
  output.pos = float4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  return output;
}

float4 FsrEasuRF(float2 p) { return sourceTex.GatherRed(sourceSampler, p); }
float4 FsrEasuGF(float2 p) { return sourceTex.GatherGreen(sourceSampler, p); }
float4 FsrEasuBF(float2 p) { return sourceTex.GatherBlue(sourceSampler, p); }

void FsrEasuTapF(
  inout float3 aC,
  inout float aW,
  float2 off,
  float2 dir,
  float2 len,
  float lob,
  float clp,
  float3 c)
{
  float2 v;
  v.x = (off.x * dir.x) + (off.y * dir.y);
  v.y = (off.x * (-dir.y)) + (off.y * dir.x);
  v *= len;
  float d2 = v.x * v.x + v.y * v.y;
  d2 = min(d2, clp);
  float wB = (2.0 / 5.0) * d2 - 1.0;
  float wA = lob * d2 - 1.0;
  wB *= wB;
  wA *= wA;
  wB = (25.0 / 16.0) * wB - (25.0 / 16.0 - 1.0);
  float w = wB * wA;
  aC += c * w;
  aW += w;
}

void FsrEasuSetF(
  inout float2 dir,
  inout float len,
  float2 pp,
  bool biS,
  bool biT,
  bool biU,
  bool biV,
  float lA,
  float lB,
  float lC,
  float lD,
  float lE)
{
  float w = 0.0;
  if (biS) w = (1.0 - pp.x) * (1.0 - pp.y);
  if (biT) w = pp.x * (1.0 - pp.y);
  if (biU) w = (1.0 - pp.x) * pp.y;
  if (biV) w = pp.x * pp.y;

  float dc = lD - lC;
  float cb = lC - lB;
  float lenX = max(abs(dc), abs(cb));
  lenX = 1.0 / lenX;
  float dirX = lD - lB;
  dir.x += dirX * w;
  lenX = saturate(abs(dirX) * lenX);
  lenX *= lenX;
  len += lenX * w;

  float ec = lE - lC;
  float ca = lC - lA;
  float lenY = max(abs(ec), abs(ca));
  lenY = 1.0 / lenY;
  float dirY = lE - lA;
  dir.y += dirY * w;
  lenY = saturate(abs(dirY) * lenY);
  lenY *= lenY;
  len += lenY * w;
}

float4 EASUPSMain(PSIn input) : SV_TARGET
{
  uint2 ip = uint2(input.pos.xy);
  float2 pp = float2(ip) * asfloat(con0.xy) + asfloat(con0.zw);
  float2 fp = floor(pp);
  pp -= fp;

  float2 p0 = fp * asfloat(con1.xy) + asfloat(con1.zw);
  float2 p1 = p0 + asfloat(con2.xy);
  float2 p2 = p0 + asfloat(con2.zw);
  float2 p3 = p0 + asfloat(con3.xy);

  float4 bczzR = FsrEasuRF(p0);
  float4 bczzG = FsrEasuGF(p0);
  float4 bczzB = FsrEasuBF(p0);
  float4 ijfeR = FsrEasuRF(p1);
  float4 ijfeG = FsrEasuGF(p1);
  float4 ijfeB = FsrEasuBF(p1);
  float4 klhgR = FsrEasuRF(p2);
  float4 klhgG = FsrEasuGF(p2);
  float4 klhgB = FsrEasuBF(p2);
  float4 zzonR = FsrEasuRF(p3);
  float4 zzonG = FsrEasuGF(p3);
  float4 zzonB = FsrEasuBF(p3);

  float4 bczzL = bczzB * 0.5 + (bczzR * 0.5 + bczzG);
  float4 ijfeL = ijfeB * 0.5 + (ijfeR * 0.5 + ijfeG);
  float4 klhgL = klhgB * 0.5 + (klhgR * 0.5 + klhgG);
  float4 zzonL = zzonB * 0.5 + (zzonR * 0.5 + zzonG);

  float bL = bczzL.x;
  float cL = bczzL.y;
  float iL = ijfeL.x;
  float jL = ijfeL.y;
  float fL = ijfeL.z;
  float eL = ijfeL.w;
  float kL = klhgL.x;
  float lL = klhgL.y;
  float hL = klhgL.z;
  float gL = klhgL.w;
  float oL = zzonL.z;
  float nL = zzonL.w;

  float2 dir = float2(0.0, 0.0);
  float len = 0.0;
  FsrEasuSetF(dir, len, pp, true, false, false, false, bL, eL, fL, gL, jL);
  FsrEasuSetF(dir, len, pp, false, true, false, false, cL, fL, gL, hL, kL);
  FsrEasuSetF(dir, len, pp, false, false, true, false, fL, iL, jL, kL, nL);
  FsrEasuSetF(dir, len, pp, false, false, false, true, gL, jL, kL, lL, oL);

  float2 dir2 = dir * dir;
  float dirR = dir2.x + dir2.y;
  bool zro = dirR < (1.0 / 32768.0);
  dirR = rsqrt(dirR);
  dirR = zro ? 1.0 : dirR;
  dir.x = zro ? 1.0 : dir.x;
  dir *= dirR;
  len = len * 0.5;
  len *= len;
  float stretch = (dir.x * dir.x + dir.y * dir.y) * (1.0 / max(abs(dir.x), abs(dir.y)));
  float2 len2 = float2(1.0 + (stretch - 1.0) * len, 1.0 - 0.5 * len);
  float lob = 0.5 + ((0.25 - 0.04) - 0.5) * len;
  float clp = 1.0 / lob;

  float3 min4 = min(
    min(float3(ijfeR.z, ijfeG.z, ijfeB.z), float3(klhgR.w, klhgG.w, klhgB.w)),
    min(float3(ijfeR.y, ijfeG.y, ijfeB.y), float3(klhgR.x, klhgG.x, klhgB.x)));
  float3 max4 = max(
    max(float3(ijfeR.z, ijfeG.z, ijfeB.z), float3(klhgR.w, klhgG.w, klhgB.w)),
    max(float3(ijfeR.y, ijfeG.y, ijfeB.y), float3(klhgR.x, klhgG.x, klhgB.x)));

  float3 aC = float3(0.0, 0.0, 0.0);
  float aW = 0.0;
  FsrEasuTapF(aC, aW, float2(0.0, -1.0) - pp, dir, len2, lob, clp, float3(bczzR.x, bczzG.x, bczzB.x));
  FsrEasuTapF(aC, aW, float2(1.0, -1.0) - pp, dir, len2, lob, clp, float3(bczzR.y, bczzG.y, bczzB.y));
  FsrEasuTapF(aC, aW, float2(-1.0, 1.0) - pp, dir, len2, lob, clp, float3(ijfeR.x, ijfeG.x, ijfeB.x));
  FsrEasuTapF(aC, aW, float2(0.0, 1.0) - pp, dir, len2, lob, clp, float3(ijfeR.y, ijfeG.y, ijfeB.y));
  FsrEasuTapF(aC, aW, float2(0.0, 0.0) - pp, dir, len2, lob, clp, float3(ijfeR.z, ijfeG.z, ijfeB.z));
  FsrEasuTapF(aC, aW, float2(-1.0, 0.0) - pp, dir, len2, lob, clp, float3(ijfeR.w, ijfeG.w, ijfeB.w));
  FsrEasuTapF(aC, aW, float2(1.0, 1.0) - pp, dir, len2, lob, clp, float3(klhgR.x, klhgG.x, klhgB.x));
  FsrEasuTapF(aC, aW, float2(2.0, 1.0) - pp, dir, len2, lob, clp, float3(klhgR.y, klhgG.y, klhgB.y));
  FsrEasuTapF(aC, aW, float2(2.0, 0.0) - pp, dir, len2, lob, clp, float3(klhgR.z, klhgG.z, klhgB.z));
  FsrEasuTapF(aC, aW, float2(1.0, 0.0) - pp, dir, len2, lob, clp, float3(klhgR.w, klhgG.w, klhgB.w));
  FsrEasuTapF(aC, aW, float2(1.0, 2.0) - pp, dir, len2, lob, clp, float3(zzonR.z, zzonG.z, zzonB.z));
  FsrEasuTapF(aC, aW, float2(0.0, 2.0) - pp, dir, len2, lob, clp, float3(zzonR.w, zzonG.w, zzonB.w));

  float3 pix = min(max4, max(min4, aC * (1.0 / aW)));
  return float4(pix, 1.0);
}

#define FSR_RCAS_LIMIT (0.25 - (1.0 / 16.0))

float4 RCASPSMain(PSIn input) : SV_TARGET
{
  int2 maxp = max(outputSize - 1, int2(0, 0));
  int2 ip = clamp(int2(input.pos.xy) - viewportOffset, int2(0, 0), maxp);
  int2 p = ip;

  float3 b = sourceTex.Load(int3(clamp(p + int2(0, -1), int2(0, 0), maxp), 0)).rgb;
  float3 d = sourceTex.Load(int3(clamp(p + int2(-1, 0), int2(0, 0), maxp), 0)).rgb;
  float3 e = sourceTex.Load(int3(p, 0)).rgb;
  float3 f = sourceTex.Load(int3(clamp(p + int2(1, 0), int2(0, 0), maxp), 0)).rgb;
  float3 h = sourceTex.Load(int3(clamp(p + int2(0, 1), int2(0, 0), maxp), 0)).rgb;

  float bR = b.r;
  float bG = b.g;
  float bB = b.b;
  float dR = d.r;
  float dG = d.g;
  float dB = d.b;
  float eR = e.r;
  float eG = e.g;
  float eB = e.b;
  float fR = f.r;
  float fG = f.g;
  float fB = f.b;
  float hR = h.r;
  float hG = h.g;
  float hB = h.b;

  float bL = bB * 0.5 + (bR * 0.5 + bG);
  float dL = dB * 0.5 + (dR * 0.5 + dG);
  float eL = eB * 0.5 + (eR * 0.5 + eG);
  float fL = fB * 0.5 + (fR * 0.5 + fG);
  float hL = hB * 0.5 + (hR * 0.5 + hG);

  float nz = 0.25 * bL + 0.25 * dL + 0.25 * fL + 0.25 * hL - eL;
  float range = max(max(max(bL, dL), max(eL, fL)), hL) -
                min(min(min(bL, dL), min(eL, fL)), hL);
  nz = range > 1.0 / 32768.0 ? saturate(abs(nz) / range) : 1.0;
  nz = -0.5 * nz + 1.0;

  float mn4R = min(min(min(bR, dR), fR), hR);
  float mn4G = min(min(min(bG, dG), fG), hG);
  float mn4B = min(min(min(bB, dB), fB), hB);
  float mx4R = max(max(max(bR, dR), fR), hR);
  float mx4G = max(max(max(bG, dG), fG), hG);
  float mx4B = max(max(max(bB, dB), fB), hB);

  float2 peakC = float2(1.0, -4.0);
  float hitMinR = min(mn4R, eR) * (1.0 / (4.0 * mx4R));
  float hitMinG = min(mn4G, eG) * (1.0 / (4.0 * mx4G));
  float hitMinB = min(mn4B, eB) * (1.0 / (4.0 * mx4B));
  float hitMaxR = (peakC.x - max(mx4R, eR)) * (1.0 / (4.0 * mn4R + peakC.y));
  float hitMaxG = (peakC.x - max(mx4G, eG)) * (1.0 / (4.0 * mn4G + peakC.y));
  float hitMaxB = (peakC.x - max(mx4B, eB)) * (1.0 / (4.0 * mn4B + peakC.y));

  float lobeR = max(-hitMinR, hitMaxR);
  float lobeG = max(-hitMinG, hitMaxG);
  float lobeB = max(-hitMinB, hitMaxB);
  float lobe = max(-FSR_RCAS_LIMIT, min(max(max(lobeR, lobeG), lobeB), 0.0)) * asfloat(rcas.x);
  lobe *= nz;

  float rcpL = 1.0 / (4.0 * lobe + 1.0);
  float3 pix;
  pix.r = (lobe * bR + lobe * dR + lobe * hR + lobe * fR + eR) * rcpL;
  pix.g = (lobe * bG + lobe * dG + lobe * hG + lobe * fG + eG) * rcpL;
  pix.b = (lobe * bB + lobe * dB + lobe * hB + lobe * fB + eB) * rcpL;
  return float4(pix, 1.0);
}
)";
