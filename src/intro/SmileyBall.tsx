import * as THREE from "three";
import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { MarchingCubes, MarchingCube, Environment, Bounds } from "@react-three/drei";
import { Physics, RigidBody, BallCollider, RapierRigidBody } from "@react-three/rapier";

interface MetaBallProps {
  color: string;
  position?: [number, number, number];
}

// Global state for touch position and tilt
const globalPointer = { x: 0, y: 0 };
const globalTilt = { x: 0, y: 0 };

function MetaBall({ color, ...props }: MetaBallProps) {
  const api = useRef<RapierRigidBody>(null);
  const vec = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    if (!api.current) return;
    delta = Math.min(delta, 0.1);
    const translation = api.current.translation();
    vec.current.set(translation.x, translation.y, translation.z);

    // Safety check to prevent NaN when at center
    if (vec.current.lengthSq() < 0.0001) return;

    api.current.applyImpulse(
      vec.current.normalize().multiplyScalar(delta * -0.05),
      true
    );
  });

  return (
    <RigidBody ref={api} colliders={false} linearDamping={4} angularDamping={0.95} {...props}>
      <MarchingCube strength={0.35} subtract={6} color={new THREE.Color(color)} />
      <BallCollider args={[0.1]} />
    </RigidBody>
  );
}

function Pointer() {
  const ref = useRef<RapierRigidBody>(null);
  const vec = useRef(new THREE.Vector3());
  const { viewport } = useThree();
  
  useFrame(({ pointer }) => {
    if (!ref.current) return;
    const { width, height } = viewport.getCurrentViewport();
    
    // Use touch position if available, otherwise use mouse pointer
    const px = globalPointer.x !== 0 ? globalPointer.x : pointer.x;
    const py = globalPointer.y !== 0 ? globalPointer.y : pointer.y;
    
    vec.current.set(px * (width / 2), py * (height / 2), 0);
    ref.current.setNextKinematicTranslation(vec.current);
  });
  
  return (
    <RigidBody type="kinematicPosition" colliders={false} ref={ref}>
      <MarchingCube strength={0.5} subtract={10} color={new THREE.Color("orange")} />
      <BallCollider args={[0.1]} />
    </RigidBody>
  );
}

// Component to handle tilt-based gravity
function TiltGravity() {
  const { scene } = useThree();
  
  useFrame(() => {
    // Access the physics world through rapier and update gravity based on tilt
    // This is handled externally via the Physics component's gravity prop
  });
  
  return null;
}

function Scene({ gravity }: { gravity: [number, number, number] }) {
  return (
    <Physics gravity={gravity}>
      {/* resolution drives an O(n^3) field evaluation on the main thread every
          frame (80 -> 512k voxels, 56 -> 176k), so it dominates the cost of
          dragging the blobs around. 56 keeps these large, rounded shapes
          looking identical while making interaction ~3x cheaper. */}
      <MarchingCubes resolution={56} maxPolyCount={10000} enableUvs={false} enableColors>
        <meshStandardMaterial vertexColors roughness={0.4} />
        <MetaBall color="indianred" position={[1, 1, 0.5]} />
        <MetaBall color="skyblue" position={[-1, -1, -0.5]} />
        <MetaBall color="teal" position={[2, 2, 0.5]} />
        <MetaBall color="orange" position={[-2, -2, -0.5]} />
        <MetaBall color="hotpink" position={[3, 3, 0.5]} />
        <MetaBall color="aquamarine" position={[-3, -3, -0.5]} />
        <Pointer />
      </MarchingCubes>
    </Physics>
  );
}

export default function SmileyBall() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [gravity, setGravity] = useState<[number, number, number]>([0, 2, 0]);
  
  useEffect(() => {
    // Touch event handlers
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) {
          // Convert touch position to normalized coordinates (-1 to 1)
          globalPointer.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
          globalPointer.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        }
      }
    };
    
    const handleTouchStart = (e: TouchEvent) => {
      handleTouchMove(e);
    };
    
    const handleTouchEnd = () => {
      // Keep last position for a moment, then reset
      setTimeout(() => {
        globalPointer.x = 0;
        globalPointer.y = 0;
      }, 100);
    };
    
    // Device orientation for tilt mechanics
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        // gamma: left/right tilt (-90 to 90)
        // beta: front/back tilt (-180 to 180)
        const tiltX = Math.max(-30, Math.min(30, e.gamma)) / 30; // Normalize to -1 to 1
        const tiltY = Math.max(-30, Math.min(30, e.beta - 45)) / 30; // Offset for natural holding position
        
        // Update gravity based on tilt
        setGravity([tiltX * 3, 2 - tiltY * 2, 0]);
      }
    };
    
    // Request permission for device orientation on iOS
    const requestOrientationPermission = async () => {
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        try {
          const permission = await (DeviceOrientationEvent as any).requestPermission();
          if (permission === 'granted') {
            window.addEventListener('deviceorientation', handleOrientation);
          }
        } catch (err) {
          console.log('Device orientation permission denied');
        }
      } else {
        // Non-iOS devices
        window.addEventListener('deviceorientation', handleOrientation);
      }
    };
    
    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    
    // Request orientation permission on first touch
    const handleFirstTouch = () => {
      requestOrientationPermission();
      window.removeEventListener('touchstart', handleFirstTouch);
    };
    window.addEventListener('touchstart', handleFirstTouch, { once: true });
    
    return () => {
      if (container) {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      }
      window.removeEventListener('deviceorientation', handleOrientation);
      window.removeEventListener('touchstart', handleFirstTouch);
    };
  }, []);
  
  return (
    <div ref={containerRef} className="w-full h-full touch-none">
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 5], fov: 25 }}>
        <color attach="background" args={["#efe6cf"]} />
        <ambientLight intensity={1} />
        <Scene gravity={gravity} />
        <Environment files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_workshop_foundry_1k.hdr" />
        <Bounds fit clip observe margin={1}>
          <mesh visible={false}>
            <boxGeometry />
          </mesh>
        </Bounds>
      </Canvas>
    </div>
  );
}
