import "./style.scss";
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const canvas = document.querySelector("#experience-canvas");

const scene = new THREE.Scene();
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

// Loaders
const textureLoader = new THREE.TextureLoader();

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

const environmentMap = new THREE.CubeTextureLoader()
  .setPath('textures/skybox/')
  .load([
    'px.webp',
    'nx.webp',
    'py.webp',
    'ny.webp',
    'pz.webp',
    'nz.webp'
  ]);

// Texture map
const textureMap = {
  First: "/textures/FirstTextureSet.webp",
  Second: "/textures/SecondTextureSet.webp",
  Third: "/textures/ThirdTextureSet.webp",
  Fourth: "/textures/FourthTextureSet.webp",
  Fifth: "/textures/FifthTextureSet.webp",
  Sixth: "/textures/SixthTextureSet.webp",
  Seventh: "/textures/SeventhTextureSet.webp",
  Eighth: "/textures/EighthTextureSet.webp",
  Ninth: "/textures/NinethTextureSet.webp",
  Tenth: "/textures/TenthTextureSet.webp"
};

// Load day textures only
const loadedTextures = {};
Object.entries(textureMap).forEach(([key, path]) => {
  const texture = textureLoader.load(path);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  loadedTextures[key] = texture;
});

const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(5, 5, 5);
scene.add(light);

const glassMaterial = new THREE.MeshPhysicalMaterial({
          transmission: 0.8,
          opacity: 1,
          metalness: 0,
          roughness: 0,
          ior: 1.5,
          thickness: 0.1,
          specularIntensity: 1,
          envMap: environmentMap,
          specularColor: 0xffffff,
          envMapIntensity: 1,
          depthWrite: false,
        });

  const wineMaterial = new THREE.MeshPhysicalMaterial({
          color: 0x61222e,
          transparent: true,
          opacity: 0.66,
          depthWrite: false
        })


  const videoElement = document.createElement("video");
  videoElement.src = "/textures/video/Screen.mp4";
  videoElement.loop = true;
  videoElement.muted = true;
  videoElement.playsInline = true;
  videoElement.autoplay = true;
  videoElement.play();

  const videoTexture = new THREE.VideoTexture(videoElement);
  videoTexture.colorSpace = THREE.SRGBColorSpace;
  videoTexture.flipY = false;

  const videoElement2 = document.createElement("video");
  videoElement2.src = "/textures/video/TV.mp4";
  videoElement2.loop = true;
  videoElement2.muted = true;
  videoElement2.playsInline = true;
  videoElement2.autoplay = true;
  videoElement.play();

  const videoTexture2 = new THREE.VideoTexture(videoElement2);
  videoTexture2.colorSpace = THREE.SRGBColorSpace;
  videoTexture2.flipY = false;
        
  const imageTexture = textureLoader.load("/images/CodeEditor.webp");
  imageTexture.flipY = false;
  imageTexture.colorSpace = THREE.SRGBColorSpace;

  const imageTexture2 = textureLoader.load("/images/LinkedIn_Photo.webp");
  imageTexture2.flipY = false;
  imageTexture2.colorSpace = THREE.SRGBColorSpace;

  const imageTexture3 = textureLoader.load("/images/Beach_Photo.webp");
  imageTexture3.flipY = false;
  imageTexture3.colorSpace = THREE.SRGBColorSpace;

  const imageTexture4 = textureLoader.load("/images/Ghibli_Painting.webp");
  imageTexture4.flipY = false;
  imageTexture4.colorSpace = THREE.SRGBColorSpace;

  const imageTexture5 = textureLoader.load("/images/Cats.webp");
  imageTexture5.flipY = false;
  imageTexture5.colorSpace = THREE.SRGBColorSpace;



// Load GLTF Model
loader.load("/models/Room_Profolio.glb", (glb) => {
  glb.scene.traverse(child => {
    if (child.isMesh) {
      if (child.name.includes("Wine")) {
        child.material = wineMaterial
      } 
      else if (child.name.includes("Glass")) {
        child.material = glassMaterial;
      } 
      else if(child.name == "Screen"){
        child.material = new THREE.MeshBasicMaterial({
          map: imageTexture
        });
      } else if (child.name == "Screen001") {
        child.material = new THREE.MeshBasicMaterial({
          map: videoTexture
        });
      } else if (child.name == "Screen002") {
        child.material = new THREE.MeshBasicMaterial({
          map: videoTexture2
        });
      } else if (child.name == "Picture") {
        child.material = new THREE.MeshBasicMaterial({
          map: imageTexture2
        });
      } else if (child.name == "Picture002") {
        child.material = new THREE.MeshBasicMaterial({
          map: imageTexture3
        });
      } else if (child.name == "Picture003") {
        child.material = new THREE.MeshBasicMaterial({
          map: imageTexture4
        });
      } else if (child.name == "Picture001") {
        child.material = new THREE.MeshBasicMaterial({
          map: imageTexture5
        });
      } else {
        Object.keys(textureMap).forEach(textureKey => {
          if (child.name.includes(textureKey)) {
            const material = new THREE.MeshBasicMaterial({
              map: loadedTextures[textureKey],
            });
            child.material = material;

            if (child.material.map) {
              child.material.minFilter = THREE.LinearFilter;
            }
          }
        });
      }
    }
  });

  scene.add(glb.scene);
});

// Camera
const camera = new THREE.PerspectiveCamera(35, sizes.width / sizes.height, 0.1, 1000);
camera.position.set(26.21131907253588, 20.195938194296943, 26.82068416591988);


// Renderer
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(-0.6388761849161843, 4.685146455099664, -1.8199404781491306);

// Resize Handling
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Animation Loop
const render = () => {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(render);
};

render();
