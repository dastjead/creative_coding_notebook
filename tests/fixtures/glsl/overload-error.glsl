mat3 rotate3D(vec3 axis, float angle) {
  return mat3(1.0);
}

void mainImage(out vec4 color, in vec2 point) {
  mat3 rotation = rotate3D(point, iTime);
  color = vec4(rotation * vec3(1.0), 1.0);
}
