function setup() {
  createCanvas(240, 240, WEBGL);
}

function draw() {
  background(12);
  normalMaterial();
  rotateY(frameCount * 0.02);
  box(86);
}
