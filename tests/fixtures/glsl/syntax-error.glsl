void mainImage(out vec4 color, in vec2 point) {
  color = vec4(point.xy / iResolution.xy, 1.0)
}
