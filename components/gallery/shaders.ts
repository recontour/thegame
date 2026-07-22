/** Shared GLSL for cinematic photo planes (landing + gallery). */

export const photoVertexShader = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Fragment: aspect is handled by mesh scale (contain), not UV stretch.
 * uModeReveal: 1 = landing exposure ramp. Gallery typically keeps progress high.
 * uGlitch: 0–1 elegant digital glitch + soft chromatic aberration.
 * uGrain: constant subtle film/digital noise.
 * uPointer: finger parallax in UV space.
 * uOpacity: plane fade for transitions.
 */
export const photoFragmentShader = /* glsl */ `
  precision mediump float;

  uniform sampler2D uTexture;
  uniform float uProgress;
  uniform float uTime;
  uniform float uGlitch;
  uniform float uGrain;
  uniform float uModeReveal;
  uniform float uOpacity;
  uniform vec2 uPointer;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    vec2 uv = vUv;

    float touch = smoothstep(0.0, 0.12, uProgress);
    uv += uPointer * 0.022 * touch;

    float mid = sin(clamp(uProgress, 0.0, 1.0) * 3.14159265);
    float living = mix(0.22, 0.8, mid) * mix(0.45, 1.0, uModeReveal) + uGlitch * 0.5;
    float n1 = noise(uv * 3.2 + uTime * 0.12);
    float n2 = noise(uv * 6.5 - uTime * 0.08 + 12.0);
    vec2 warp = vec2(
      sin(uv.y * 9.0 + uTime * 0.35 + n1 * 2.0),
      cos(uv.x * 7.0 - uTime * 0.28 + n2 * 2.0)
    );
    uv += warp * 0.008 * living;
    uv += uPointer.yx * vec2(-1.0, 1.0) * 0.01 * living;

    // restrained digital glitch — sparse horizontal slices
    float g = clamp(uGlitch, 0.0, 1.0);
    if (g > 0.001) {
      float band = floor(uv.y * mix(12.0, 22.0, g) + uTime * 8.0);
      float bandN = hash(vec2(band, floor(uTime * 11.0)));
      float slice = step(0.88, bandN);
      float shift = (hash(vec2(band * 3.1, 7.7)) - 0.5) * 0.045 * g * slice;
      uv.x += shift;
      // rare micro tear
      float tear = step(0.97, hash(vec2(floor(uv.y * 40.0), floor(uTime * 6.0))));
      uv.x += tear * (hash(vec2(uTime, band)) - 0.5) * 0.03 * g;
    }

    // soft chromatic aberration (stronger while glitching / mid-reveal)
    float ca = 0.0015 + g * 0.0065 + mid * 0.002 * uModeReveal;
    vec2 caDir = normalize(uv - 0.5 + 0.0001) * ca;
    caDir += uPointer * 0.0015 * g;

    float r = texture2D(uTexture, uv + caDir * 1.15).r;
    float gre = texture2D(uTexture, uv).g;
    float b = texture2D(uTexture, uv - caDir * 0.95).b;
    vec3 tex = vec3(r, gre, b);

    // emerge / presence
    float reveal = smoothstep(0.0, 1.0, uProgress);
    float exposure = mix(1.0, pow(reveal, 1.55) * 1.08, uModeReveal);
    float gate = mix(1.0, smoothstep(0.0, 0.22, reveal), uModeReveal);
    vec3 col = tex * exposure * gate;

    // warm light-leak only on landing reveal
    float edge = length(vUv - 0.5);
    float leakMask = smoothstep(0.15, 0.92, edge);
    float leakPulse = 0.65 + 0.35 * sin(uTime * 0.45 + edge * 5.0 + n1 * 3.0);
    float leak = leakMask * reveal * mid * leakPulse * 0.18 * uModeReveal;
    col += vec3(1.0, 0.52, 0.28) * leak;

    // soft vignette
    float vig = mix(0.92, mix(0.35, 1.0, reveal), uModeReveal);
    vig *= 1.0 - smoothstep(0.45, 1.2, edge) * mix(0.22, 0.85 - reveal * 0.35, uModeReveal);
    col *= vig;

    // glitch luminance tick (very soft)
    col += vec3(0.04, 0.05, 0.06) * g * step(0.93, hash(vec2(floor(uTime * 20.0), 1.2)));

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      col = vec3(0.0);
    }

    // constant subtle grain + a touch more during glitch
    float grainAmt = uGrain + g * 0.02;
    float grain = (hash(vUv * 900.0 + uTime * 0.35) - 0.5) * grainAmt * max(reveal, 0.15);
    col += grain;

    gl_FragColor = vec4(col, uOpacity);
  }
`;
