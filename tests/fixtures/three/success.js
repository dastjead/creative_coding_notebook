const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 10);
camera.position.z = 2.5;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(240, 240);
document.body.append(renderer.domElement);
const mesh = new THREE.Mesh(
  new THREE.TorusKnotGeometry(0.55, 0.18, 64, 12),
  new THREE.MeshNormalMaterial(),
);
scene.add(mesh);
renderer.render(scene, camera);
