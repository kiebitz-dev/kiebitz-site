// Auswahl aus three.js für assets/experience.js. Gebündelt und verkleinert
// nach assets/vendor/three.min.js, damit die Seite nur lädt, was die Bühne braucht.
// Neu bauen (three und esbuild in einem beliebigen node_modules auf NODE_PATH):
//   npx esbuild scripts/vendor/three.entry.js --bundle --format=esm --minify \
//     --legal-comments=eof --outfile=assets/vendor/three.min.js
export {
  ACESFilmicToneMapping, AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry,
  CanvasTexture, CircleGeometry, Color, DirectionalLight, DoubleSide, ExtrudeGeometry,
  Float32BufferAttribute, Fog, Group, HemisphereLight, InstancedBufferAttribute, InstancedMesh,
  LatheGeometry, LineBasicMaterial, LineLoop, Mesh, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, Object3D, PCFShadowMap, PMREMGenerator, PerspectiveCamera, PlaneGeometry,
  PointLight, Points, PointsMaterial, RingGeometry, SRGBColorSpace, Scene, ShaderMaterial, Shape,
  ShapeGeometry, SphereGeometry, Vector2, Vector3, WebGLRenderer
} from "three";
export { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
export { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
export { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
export { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
export { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
