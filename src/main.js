import "./style.scss";
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from "gsap";

const clock = new THREE.Clock();

const canvas = document.querySelector("#experience-canvas");

const scene = new THREE.Scene();
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};

const modals = {
  about: document.querySelector(".modal.about"),
  education: document.querySelector(".modal.education"),
  experience: document.querySelector(".modal.experience"),
  projects: document.querySelector(".modal.projects"),
  education: document.querySelector(".modal.education"),
  contact: document.querySelector(".modal.contact")
}

// Function to disable scrolling
function disableScrolling() {
  document.body.style.overflow = 'hidden';
}

// Function to enable scrolling
function enableScrolling() {
  document.body.style.overflow = 'auto';
}


let touchHappened = false;

document.querySelectorAll(".modal-exit-button").forEach((button) => {
  button.addEventListener("touchend", (e)=> {
    touchHappened
    e.preventDefault();
    const modal = e.target.closest(".modal");
    hideModal(modal);
  }, {passive: false})

  button.addEventListener("click", (e)=> {
    if(touchHappened) return;
    e.preventDefault();
    const modal = e.target.closest(".modal");
    hideModal(modal);
  }, {passive: false})
})

let modalOpen = false;
const showModal = (modal) => {
  console.log(modal);
  if (modalOpen) return;

  disableScrolling();
  modalOpen = true;

  // Add the "active" class for CSS control
  modal.classList.add("active");
  document.body.classList.add("modal-active");

  // Set initial opacity to 0
  gsap.set(modal, { opacity: 0 });

  // Animate to visible
  gsap.to(modal, {
    opacity: 1,
    duration: 0.5,
  });
};

const hideModal = (modal) => {
  enableScrolling();  // Re-enable scrolling
  modalOpen = false;

  gsap.to(modal, {
    opacity: 0,
    duration: 0.5,
    onComplete: () => {
      modal.style.display = "none";
    },
  });
};


const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Social Links
const socialLinks = {
  GitHub: "https://github.com",
  Linkedin: "https://linkedin.com",
}

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

function handleRaycasterInteraction() {
if(currentIntersect.length > 0){
    const object = currentIntersect[0].object;

    Object.entries(socialLinks).forEach(([key, url]) => {
      if(object.name.includes(key)) {
          const newWindow = window.open();
          newWindow.opener = null;
          newWindow.location = url;
          newWindow.target = "_blank";
          newWindow.rel = "noopener noreferrer"
        }
    });

    if(object.name.includes("About")) {
      showModal(modals.about)
    } else if(object.name.includes("Experience")) {
      showModal(modals.experience)
    } else if(object.name.includes("Projects")) {
      showModal(modals.projects)
    } else if(object.name.includes("Education")) {
      showModal(modals.education)
    } else if(object.name.includes("Contact")) {
      showModal(modals.contact)
    } else if(object.name.includes("Resume")) {
      showModal(modals.experience)
    } 
  }
}

window.addEventListener("mousemove", (e) => {
  touchHappened = false;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("touchstart", (e) => {
  e.preventDefault()
  pointer.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (e.touches[0].clientY / window.innerHeight) * 2 + 1;
}, {passive: false});

window.addEventListener("touchend", (e) => {
  e.preventDefault()
  handleRaycasterInteraction()
}, {passive: false});

window.addEventListener("click", handleRaycasterInteraction);

let mushroomMesh = null;
let raycasterObjects = [];


let currentIntersect = [];
// Load GLTF Model
loader.load("/models/Room_Profolio.glb", (glb) => {
  glb.scene.traverse(child => {
    if (child.isMesh) {
      if (child.name.includes("Raycast")) {
        raycasterObjects.push(child);
      }
      if (child.name.includes("Wine")) {
        child.material = wineMaterial
      }
      else if (child.name.includes("Glass")) {
        child.material = glassMaterial;
      }
      else if (child.name == "Screen") {
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

          if (child.name.includes("PowerMushroom")) {
            mushroomMesh = child;
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

  const elapsedTime = clock.getElapsedTime();
  // Animate mushroom hover
  if (mushroomMesh) {
    const baseY = 8.818815231323242;
    mushroomMesh.position.y = baseY + Math.sin(elapsedTime * 2) * 0.1;
  }

  //Raycaster

  // update the picking ray with the camera and pointer position
  raycaster.setFromCamera(pointer, camera);

  // calculate objects intersecting the picking ray
  currentIntersect = raycaster.intersectObjects(raycasterObjects);

  for (let i = 0; i < currentIntersect.length; i++) {

    // Raycaster interactions

  }
  if (currentIntersect.length > 0) {
    const currentIntersectObject = currentIntersect[0].object;
    if (currentIntersectObject.name.includes("Pointer")) {
      if(!modalOpen) document.body.style.cursor = "pointer";
      
    } 
  } else {
      document.body.style.cursor = "default";
  }


  renderer.render(scene, camera);
  requestAnimationFrame(render);
};

render();