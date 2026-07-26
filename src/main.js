import "./style.scss";
import * as THREE from 'three';
import { OrbitControls } from './utils/OrbitControls.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import gsap from "gsap";
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import IntroScreen from "./intro/IntroScreen";
import { markAssetsReady } from "./lib/preloadImages";


const clock = new THREE.Clock();

const canvas = document.querySelector("#experience-canvas");

const scene = new THREE.Scene();
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight
};


const manager = new THREE.LoadingManager();

const loadingScreen = document.querySelector(".loading-screen");

// The room idles (no rendering, raycasting, or video decode) until the user
// enters, so the intro animation gets the whole frame budget.
let roomActive = false;

// On enter, the room first renders a few frames BEHIND the intro screen so
// any residual first-draw cost happens while the blobs + spinner are still
// showing; only then does the reveal animation start.
let warmupFramesLeft = 0;
let onRoomWarm = null;

// The blobs own the main thread until the user asks to enter. The room's GPU
// warm-up runs in whatever time is left over between blob frames (see
// yieldToBlobs), so it can't cost them frames. `roomWarm` resolves when the
// room is actually ready to draw; entering waits on it behind the spinner.
let markRoomWarm;
const roomWarm = new Promise((resolve) => {
  markRoomWarm = resolve;
});
// Flips once the user tries to enter: from then on there is nothing to
// protect, so the remaining warm-up runs flat out instead of idle-paced.
let enterRequested = false;

// IntroScreen is copied line-for-line from the ziyue repo (React + R3F).
// It waits for typing to finish AND preloadResumeProjectImages() to resolve,
// which here is wired to the room's LoadingManager via markAssetsReady().
const introRoot = createRoot(loadingScreen);
introRoot.render(
  createElement(IntroScreen, {
    onEnter: () => {
      // Stop pacing the warm-up around the blobs and finish it as fast as
      // possible — the spinner is up now, so throughput beats smoothness.
      enterRequested = true;

      // Never let the spinner become a dead end: if the warm-up somehow never
      // finishes (a failed asset, a stalled decode), enter anyway after a few
      // seconds and let the room pay its first-draw cost then.
      Promise.race([roomWarm, new Promise((r) => setTimeout(r, 6000))]).then(() => {
        // Double-rAF: let the browser PAINT the spinner first, only then wake
        // the room's loop. Without this, the room's first frame runs in the
        // rAF phase before the spinner ever reaches the screen.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            roomActive = true;
            warmupFramesLeft = 2;
            onRoomWarm = () => {
              // Autoplay policies may reject play() when entering via scroll.
              backgroundMusic.play().catch(() => {});
              playReveal();
            };
          });
        });
      });
    },
  })
);

// Yield between warm-up steps so the room's GPU work can't cost the blobs
// frames. Texture uploads have to run on the main thread (~40ms per 2K
// atlas), so the goal is to only run them in time the blobs aren't using.
//
// Note a promise chain would NOT yield at all: .then() continuations are
// microtasks, which run inside the same task. Only a real callback does.
const yieldToBlobs = () =>
  new Promise((resolve) => {
    // Once the user has asked to enter, the spinner is up and there are no
    // blob frames worth protecting — finish as fast as the event loop allows.
    if (enterRequested) {
      setTimeout(resolve, 0);
      return;
    }
    // requestAnimationFrame never fires in a background tab, which would
    // stall the warm-up for as long as the page is hidden (e.g. opened via
    // cmd-click). Nothing to protect while hidden, so use a timer.
    if (document.visibilityState === "hidden") {
      setTimeout(resolve, 16);
      return;
    }
    // The good case: requestIdleCallback hands us the slack left over after
    // the blobs have rendered their frame, so uploads fill the gaps rather
    // than competing. The timeout keeps the warm-up progressing even if the
    // blobs never leave idle time.
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => resolve(), { timeout: 500 });
    } else {
      requestAnimationFrame(() => resolve());
    }
  });

async function warmUpRoom() {
  // Shaders: compiled in parallel by the driver, doesn't block the main thread.
  try {
    await renderer.compileAsync(scene, camera);
  } catch (e) {
    /* fall through — never block entering on the warm-up */
  }
  await yieldToBlobs();

  // Textures: collect once (materials share textures, so dedupe), then
  // upload one per yield.
  const textures = new Set();
  scene.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const mat of mats) {
      for (const key of ["map", "emissiveMap", "lightMap", "aoMap", "normalMap", "roughnessMap", "metalnessMap", "alphaMap"]) {
        const tex = mat[key];
        if (tex && !tex.isVideoTexture) textures.add(tex);
      }
    }
  });

  for (const tex of textures) {
    try {
      renderer.initTexture(tex);
    } catch (e) {
      /* skip a bad texture rather than stall the intro */
    }
    await yieldToBlobs();
  }

  // Geometry: only a real draw creates the GPU buffers for the draco-decoded
  // meshes (compileAsync/initTexture don't). controls.update() first so this
  // warm frame uses the real camera target — OrbitControls ran its initial
  // update() before controls.target was set, and a stale frustum would cull
  // meshes that the first visible frame needs.
  try {
    controls.update();
    renderer.render(scene, camera);
  } catch (e) {
    /* never block entering on the warm-up */
  }

  // Only now start pulling the screen videos, so their ~4.7MB doesn't slow
  // down the assets the intro is actually waiting on. Deliberately not
  // awaited: entering must never wait on video buffering.
  videoElement.play().catch(() => {});
  videoElement2.play().catch(() => {});
}

let warmUpStarted = false;

manager.onLoad = function () {
  // LoadingManager fires onLoad once per "wave" of loads, so guard against
  // repeating the whole warm-up.
  if (warmUpStarted) return;
  warmUpStarted = true;

  // Downloads are done, so the intro can offer "Scroll to explore" straight
  // away. The GPU warm-up that follows is deliberately NOT gated on: it runs
  // in the blobs' idle time, and if the user enters before it finishes they
  // get the spinner (see onEnter) rather than a stalled intro.
  markAssetsReady();
  warmUpRoom().finally(() => markRoomWarm());
};

function playReveal() {
  const tl = gsap.timeline();

  tl.to(loadingScreen, {
    scale: 0.3, 
    opacity: 0.7,  
    duration: 1.2,
    delay: 0.25,
    ease: "power3.out",  // Smooth easing for a clean exit
  }).to(
    loadingScreen,
    {
      scale: 0,  
      y: "-150vh", 
      transform: "perspective(1200px) rotateX(45deg) rotateY(30deg) rotateX(45deg) scale3d(1.5, 0.5, 1)",  
      opacity: 0,  
      duration: 1.5,  
      ease: "power4.inOut",  
      onComplete: () => {
        modalOpen = false;
        introRoot.unmount();
        loadingScreen.remove();
      },
    },
    "-=0.1"
  );
}





const modals = {
  about: document.querySelector(".modal.about"),
  education: document.querySelector(".modal.education"),
  experience: document.querySelector(".modal.experience"),
  projects: document.querySelector(".modal.projects"),
  education: document.querySelector(".modal.education"),
  contact: document.querySelector(".modal.contact")
}

// Function to disable scrolling
document.body.style.overflow = 'hidden';


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


const overlay = document.querySelector(".overlay");

// Close any open modal (project or main modal) when clicking on the overlay
overlay.addEventListener("click", (e) => {
  // Close project modal if open (but do not hide overlay if a main modal is still open)
  const openProjectModal = document.querySelector('.project-info[style*="display: block"]');
  if (openProjectModal) {
    gsap.to(openProjectModal, { opacity: 0, scale: 0.8, duration: 0.5, onComplete: () => {
      openProjectModal.style.display = "none";
      // Only hide overlay if no main modal is open
      const openModal = document.querySelector('.modal[style*="display: block"]');
      if (!openModal) {
        overlay.style.display = "none";
        overlay.style.opacity = 0;
        modalOpen = false;
        isRaycastingAllowed = true;
        controls.enabled = true;
      }
    }});
    return;
  }
  // Close main modal if open
  const openModal = document.querySelector('.modal[style*="display: block"]');
  if (openModal) {
    hideModal(openModal);
  }
});

let modalOpen = true;
let isRaycastingAllowed = true;
const showModal = (modal) => {
  if(modalOpen) return;
  modal.style.display = "block";
  overlay.style.display = "block";

  modalOpen = true;
  isRaycastingAllowed = false;
  controls.enabled = false;

  if (currentHoveredObject) {
    playHoverAnimation(currentHoveredObject, false);
    currentHoveredObject = null;
  }
  document.body.style.cursor = "default";

  gsap.set(modal, {
    opacity: 0,
    scale: 0,
  });
  gsap.set(overlay, {
    opacity: 0,
  });

  gsap.to(overlay, {
    opacity: 1,
    duration: 0.5,
  });

  gsap.to(modal, {
    opacity: 1,
    scale: 1,
    duration: 0.5,
    ease: "back.out(2)",
  });
};

const hideModal = (modal) => {
  modalOpen = false;
  controls.enabled = true;

  gsap.to(overlay, {
    opacity: 0,
    duration: 0.5,
  });

  gsap.to(modal, {
    opacity: 0,
    scale: 0,
    duration: 0.5,
    ease: "back.in(2)",
    onComplete: () => {
      modal.style.display = "none";
      overlay.style.display = "none";
    },
  });
  setTimeout(() => {
        isRaycastingAllowed = true;  
      }, 300);  
};

document.querySelectorAll('.folder').forEach(folder => {
  folder.addEventListener('click', () => {
    const projectId = folder.getAttribute('data-project-id');
    const modal = document.getElementById(`${projectId}`);
    if (modal) {
      // GSAP fade-in animation
      gsap.fromTo(modal, { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.5 });
      modal.style.display = 'block'; // Ensure it's shown before animating
    }
  });

  // Optional fallback for touch if click fails
  folder.addEventListener('touchend', () => {
    folder.click();
  }, { passive: true });
});

document.querySelectorAll(".project-exit-button").forEach((button) => {
  button.addEventListener("touchend", (e) => {
    e.preventDefault();
    const modal = e.target.closest(".project-info");
    if (modal) {
      // GSAP fade-out animation
      gsap.to(modal, { opacity: 0, scale: 0.8, duration: 0.5, onComplete: () => {
        modal.style.display = "none"; 
      }});
    }
  }, { passive: false });

  button.addEventListener("click", (e) => {
    if (touchHappened) return;
    e.preventDefault();
    const modal = e.target.closest(".project-info");
    if (modal) {
      // GSAP fade-out animation
      gsap.to(modal, { opacity: 0, scale: 0.8, duration: 0.5, onComplete: () => {
        modal.style.display = "none"; 
      }});
    }
  }, { passive: false });
});



window.addEventListener("mousemove", (e) => {
  touchHappened = false;
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("touchstart", (e) => {
  if (!modalOpen) e.preventDefault()
  pointer.x = (e.touches[0].clientX / window.innerWidth) * 2 - 1;
  pointer.y = - (e.touches[0].clientY / window.innerHeight) * 2 + 1;
}, {passive: false});

window.addEventListener("touchend", (e) => {
  if (!modalOpen) e.preventDefault()
  handleRaycasterInteraction()
}, {passive: false});

window.addEventListener("click", handleRaycasterInteraction);



const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

// Social Links
const socialLinks = {
  GitHub: "https://github.com/Tobbs2005",
  Linkedin: "https://www.linkedin.com/in/ziyue-fang-280a33314",
}

// Loaders
const textureLoader = new THREE.TextureLoader(manager);

const dracoLoader = new DRACOLoader(manager);
dracoLoader.setDecoderPath('/draco/');

const loader = new GLTFLoader(manager);
loader.setDRACOLoader(dracoLoader);

// Must use the shared manager: the glass material's envMap has to be loaded
// BEFORE manager.onLoad runs compileAsync + the warm render, or three will
// synchronously recompile the glass shader (and generate the PMREM) on the
// first frame after the cube completes — i.e. right after the user clicks.
const environmentMap = new THREE.CubeTextureLoader(manager)
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

const hitboxMaterial = new THREE.MeshPhysicalMaterial({
  transparent: true,   // Enable transparency
  opacity: 0,          // Set opacity to 0 (fully transparent)
  depthWrite: false,   // Ensure it doesn't interfere with other objects in the depth buffer
  depthTest: false,    // Ensure it doesn't block raycasting
})

const videoElement = document.createElement("video");
videoElement.src = "/textures/video/Screen.mp4";
videoElement.loop = true;
videoElement.muted = true;
videoElement.playsInline = true;
// The two screen videos are ~4.7MB combined — the largest asset group on a
// cold load — and nothing shows them until the user is inside the room. With
// preload="auto" they competed for bandwidth with the GLB and textures that
// actually gate the intro, so they're held back until the room is warm (see
// warmUpRoom), which still leaves the rest of the intro for them to buffer.
videoElement.preload = "none";

const videoTexture = new THREE.VideoTexture(videoElement);
videoTexture.colorSpace = THREE.SRGBColorSpace;
videoTexture.flipY = false;

const videoElement2 = document.createElement("video");
videoElement2.src = "/textures/video/TV.mp4";
videoElement2.loop = true;
videoElement2.muted = true;
videoElement2.playsInline = true;
videoElement2.preload = "none"; // see videoElement above

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

const meowAudio = new Audio('/audio/Meow.mp3');
const backgroundMusic = new Audio("/audio/Background.mp3");
backgroundMusic.loop = true;
backgroundMusic.volume = 0.5;


function handleRaycasterInteraction() {
if (modalOpen) return;
if (!isRaycastingAllowed) return;
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

    if (object.name.includes("Cat")) {
      meowAudio.play(); 
    }

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

let mushroomMesh = null;
let raycasterObjects = [];
let currentIntersect = [];
let currentHoveredObject = null;

// Hitbox logic



  const hitboxToObjectMap = new Map();

// Load GLTF Model
loader.load("/models/Room_Portfolio.glb", (glb) => {
  glb.scene.traverse(child => {
    if (child.isMesh) {
      if (child.name.includes("Raycast")) {
        raycasterObjects.push(child);
      }
      if (child.name.includes("Hover")) {
        child.userData.initialScale = new THREE.Vector3().copy(child.scale);
        child.userData.initialPosition = new THREE.Euler().copy(child.position);
        child.userData.initialRotation = new THREE.Euler().copy(child.rotation);
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
      } else  if (child.name.includes('Hitbox')) {
             
        child.material = hitboxMaterial;

        const objectUnderneathName =  child.name.replace('Hitbox', 'Object');
        const objectUnderneath = glb.scene.getObjectByName(objectUnderneathName);
        hitboxToObjectMap.set(child, objectUnderneath);
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

controls.minDistance = 5;
controls.maxDistance = 50;
controls.minPolarAngle = 0;
controls.maxPolarAngle = Math.PI/2;
controls.minAzimuthAngle = 0;
controls.maxAzimuthAngle = Math.PI/2;

controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(-0.6388761849161843, 4.685146455099664, -1.8199404781491306);


function adjustCameraForMobile() {
  if (sizes.width <= 768) { // Check if the screen width is mobile size (you can adjust this threshold)
    camera.fov = 55; // Reduce the field of view (zoom out) on mobile
  } else {
    camera.fov = 35; // Default FOV for larger screens
  }
  camera.updateProjectionMatrix(); // Update the camera's projection matrix after changing the FOV
}

// Call adjustCameraForMobile on resize and on page load
adjustCameraForMobile();

// Resize Handling
window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;

  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  adjustCameraForMobile();
});

function playHoverAnimation(object, isHovering) {
  if (object.name.includes("Hitbox")) return;
  
  // Kill previous tweens to prevent conflicting animations
  gsap.killTweensOf(object.scale);
  gsap.killTweensOf(object.rotation);
  gsap.killTweensOf(object.position);

  // Default scaling effect
  const scaleFactor = 1.3;
  
  // Handle hover in
  if (isHovering) {
    // Scale animation
    gsap.to(object.scale, {
      x: object.userData.initialScale.x * scaleFactor,
      y: object.userData.initialScale.y * scaleFactor,
      z: object.userData.initialScale.z * scaleFactor,
      duration: 0.5,
      ease: "back.out(2)",
    });

    // Rotation based on object name
    if (object.name.includes("Hover2")) {
      gsap.to(object.rotation, {
        x: object.userData.initialRotation.x + Math.PI / 8, // Rotate on X axis by PI/8
        duration: 0.5,
      ease: "back.out(2)",
      });
    } else if (object.name.includes("Hover3")) {
      gsap.to(object.rotation, {
        x: object.userData.initialRotation.x + Math.random() * Math.PI / 16, 
        y: object.userData.initialRotation.y + Math.random() * Math.PI / 16,
        z: object.userData.initialRotation.z + Math.random() * Math.PI / 16,
        duration: 0.5,
      ease: "back.out(2)",
      });
    } else if (object.name.includes("Hover4")) {
      gsap.to(object.rotation, {
        x: object.userData.initialRotation.x + Math.random() * Math.PI / 16,
        y: object.userData.initialRotation.y + Math.random() * Math.PI / 16,
        z: object.userData.initialRotation.z + Math.random() * Math.PI / 16,
        duration: 0.5,
      ease: "back.out(2)",
      });
    } else if (object.name.includes("Hover5")) {
      gsap.to(object.rotation, {
        x: object.userData.initialRotation.x + Math.random() * Math.PI / 16,
        y: object.userData.initialRotation.y + Math.random() * Math.PI / 16,
        z: object.userData.initialRotation.z + Math.random() * Math.PI / 16,
        duration: 0.5,
      ease: "back.out(2)",
      });
    }
  } 
  // Handle hover out (return to original state)
  else {
    // Scale animation to return to original scale
    gsap.to(object.scale, {
      x: object.userData.initialScale.x,
      y: object.userData.initialScale.y,
      z: object.userData.initialScale.z,
      duration: 0.5,
      ease: "back.out(2)",
    });

    // Rotation animation to return to original rotation
    gsap.to(object.rotation, {
      x: object.userData.initialRotation.x,
      y: object.userData.initialRotation.y,
      z: object.userData.initialRotation.z,
      duration: 0.5,
      ease: "back.out(2)",
    });
  }
}


  
let objectUnderHitbox = undefined;
// Animation Loop
const render = () => {
  // While the intro screen is up, idle: don't raycast or draw the room so
  // the metaball intro gets the whole frame budget.
  if (!roomActive) {
    requestAnimationFrame(render);
    return;
  }

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

  
  if (currentIntersect.length > 0) {
    const currentIntersectObject = currentIntersect[0].object;

    if(currentIntersectObject.name.includes("Hover")){
      if(currentIntersectObject !== currentHoveredObject) {
        //when new object hovered without hovering air
        if(currentHoveredObject){
          objectUnderHitbox = hitboxToObjectMap.get(currentHoveredObject);
          playHoverAnimation(currentHoveredObject, false);
          if(objectUnderHitbox) {
            playHoverAnimation(objectUnderHitbox, false);
          }
        }
        currentHoveredObject = currentIntersectObject;
        
        
        objectUnderHitbox = hitboxToObjectMap.get(currentHoveredObject);
        //if its a hitbox
        if (objectUnderHitbox) {
          playHoverAnimation(objectUnderHitbox, true);  // Play animation on the actual object
        }
        else {
          playHoverAnimation(currentIntersectObject, true);
        }
        
      }
    }


    if (currentIntersectObject.name.includes("Pointer")) {
      if(!modalOpen) document.body.style.cursor = "pointer";
      
    } 
  } else {
    if(currentHoveredObject){
      playHoverAnimation(currentHoveredObject, false);
      

      //if hitbox
      const objectUnderHitbox = hitboxToObjectMap.get(currentHoveredObject);
        if (objectUnderHitbox) {
          playHoverAnimation(objectUnderHitbox, false);  // Play animation on the actual object
        }

        currentHoveredObject = null;
    }
    document.body.style.cursor = "default";
  }


  renderer.render(scene, camera);

  // Count down the warm-up frames rendered behind the intro screen, then
  // start the reveal once the heavy first-frame work is done.
  if (warmupFramesLeft > 0) {
    warmupFramesLeft--;
    if (warmupFramesLeft === 0 && onRoomWarm) {
      const ready = onRoomWarm;
      onRoomWarm = null;
      ready();
    }
  }

  requestAnimationFrame(render);
};

render();