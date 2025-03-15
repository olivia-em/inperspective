import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Define prop types for our components
interface CubeProps {
  position: [number, number, number]
}

function Cube(props: CubeProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hovered, setHover] = useState(false)
  
  return (
    <mesh
      {...props}
      ref={mesh}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <boxGeometry />
      <meshStandardMaterial color={hovered ? 'pink' : 'orange'} />
    </mesh>
  )
}

function Scene() {
  const { scene, camera, gl } = useThree()
  const isDragging = useRef(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  const activeCube = useRef<THREE.Mesh | null>(null)
  
  // Set up global event listeners
  useEffect(() => {
    const canvas = gl.domElement
    
    const handlePointerDown = (e: PointerEvent) => {
      isDragging.current = true
      lastPosition.current = { x: e.clientX, y: e.clientY }
      
      // Check if we're clicking on a cube by doing a ray cast
      const raycaster = new THREE.Raycaster()
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1, 
        -(e.clientY / window.innerHeight) * 2 + 1
      )
      
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(scene.children, true)
      
      // Find the first mesh that's not our background plane
      const clickedMesh = intersects.find(
        (obj) => obj.object instanceof THREE.Mesh && 
        !obj.object.userData.isBackground
      )
      
      if (clickedMesh && clickedMesh.object instanceof THREE.Mesh) {
        activeCube.current = clickedMesh.object
      } else {
        activeCube.current = null
      }
    }
    
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      
      const deltaX = (e.clientX - lastPosition.current.x) * 0.01
      const deltaY = (e.clientY - lastPosition.current.y) * 0.01
      lastPosition.current = { x: e.clientX, y: e.clientY }
      
      if (activeCube.current) {
        // Rotate the cube
        activeCube.current.rotation.y += deltaX
        activeCube.current.rotation.x += deltaY
      } else {
        // Rotate the scene
        scene.rotation.y += deltaX
        scene.rotation.x += deltaY
      }
    }
    
    const handlePointerUp = () => {
      isDragging.current = false
      activeCube.current = null
    }
    
    // Handle zoom with mouse wheel
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      
      // Determine zoom direction and speed
      const zoomSpeed = 0.1
      const delta = e.deltaY > 0 ? 1 : -1
      
      // Update camera position (zoom in/out)
      camera.position.z += delta * zoomSpeed
      
      // Clamp to reasonable zoom limits
      camera.position.z = Math.max(2, Math.min(10, camera.position.z))
    }
    
    // Add event listeners to the window to capture events outside the canvas
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    
    // Add wheel event to the canvas for zoom
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    
    // Clean up event listeners on unmount
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [scene, camera, gl])
  
  return (
    <>
      {/* Background plane for scene rotation - flag it as background */}
      <mesh userData={{ isBackground: true }} position={[0, 0, -10]} scale={[100, 100, 1]}>
        <planeGeometry />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      
      {/* Cubes */}
      <Cube position={[-1.5, 0, 0]} />
      <Cube position={[1.5, 0, 0]} />
      
      {/* Lights */}
      <ambientLight intensity={4} />
      <pointLight position={[0, 0, 0]} />
    </>
  )
}

export default function Cubez() {
  return (
    <Canvas camera={{ position: [0, 0, 5] }}>
      <Scene />
    </Canvas>
  )
}