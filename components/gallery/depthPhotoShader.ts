/** Mobile-safe GLSL for depth-scattered gallery planes. */

export const depthPhotoVertex = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Distance + velocity driven look:
 * - near camera: clean, full presence
 * - far: lower opacity, soft CA, restrained digital glitch
 * - high scroll velocity: temporary chaos
 */
export const depthPhotoFragment = /* glsl */ `
  precision mediump float;

  uniform sampler2D uMap;
  uniform float uTime;
  uniform float uFocus;
  uniform float uVelocity;
  uniform float uOpacity;
  uniform vec2 uPointer;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    float far = clamp(uFocus, 0.0, 1.0);
    float vel = clamp(uVelocity, 0.0, 1.0);

    // Elegant base glitch on distant frames; velocity adds temporary chaos
    float g = far * 0.5 + vel * 0.72 * (0.3 + far * 0.7);
    g = clamp(g, 0.0, 1.0);

    vec2 uv = vUv;
    uv += uPointer * 0.016 * (1.0 - far * 0.65);

    // Sparse digital slices — never meme-loud
    if (g > 0.05) {
      float band = floor(uv.y * mix(11.0, 24.0, g) + uTime * 6.5);
      float n = hash(vec2(band, floor(uTime * 9.0)));
      float slice = step(0.9, n);
      uv.x += (hash(vec2(band * 2.1, 4.4)) - 0.5) * 0.04 * g * slice;
      float tear = step(0.975, hash(vec2(floor(uv.y * 36.0), floor(uTime * 5.0))));
      uv.x += tear * (hash(vec2(uTime, band)) - 0.5) * 0.025 * g;
    }

    // Chromatic aberration grows with distance + velocity
    float ca = 0.0012 + far * 0.008 + vel * 0.01;
    vec2 dir = normalize(uv - 0.5 + 1e-4) * ca;

    float r = texture2D(uMap, uv + dir).r;
    float gre = texture2D(uMap, uv).g;
    float b = texture2D(uMap, uv - dir * 0.9).b;
    vec3 col = vec3(r, gre, b);

    // Soft desaturation as it recedes into the void
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(col, vec3(luma), far * 0.35);

    // Vignette stronger when far
    float edge = length(vUv - 0.5);
    col *= 1.0 - smoothstep(0.35, 0.95, edge) * (0.25 + far * 0.45);

    // Out-of-bounds after distortion → pure black void
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
      col = vec3(0.0);
    }

    // Fine grain — constant, slightly more when moving
    float grain = (hash(vUv * 700.0 + uTime * 0.4) - 0.5) * (0.03 + vel * 0.04);
    col += grain;

    // Presence: near = solid, far = ghosting into black
    float presence = mix(1.0, 0.22, far * far);
    presence *= uOpacity;

    // Velocity flash — brief lift then settles (handled mainly via g)
    col *= 0.92 + (1.0 - far) * 0.1;

    gl_FragColor = vec4(col, presence);
  }
`;
