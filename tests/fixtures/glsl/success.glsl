void mainImage(out vec4 color, in vec2 point) {
  vec2 uv = point / iResolution.xy;
  color = vec4(uv, 0.4 + 0.3 * sin(iTime), 1.0);
}
