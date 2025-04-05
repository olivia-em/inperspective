import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ResponsiveImageStripProps {
  imagePaths: string[]
  maxSize?: number 
  verticalOffset?: number
  wasRotating: boolean 
  allowInteraction?: boolean
  zPosition?: number  // Add new prop type
}

interface ImageData {
  texture: THREE.Texture
  aspectRatio: number
}

export function ResponsiveImageStrip({ 
  imagePaths, 
  maxSize = 4,
  verticalOffset = 0,
  allowInteraction = true,
  wasRotating = false,
  zPosition = 0  // Add new prop for z-position
}: ResponsiveImageStripProps & { zPosition?: number }) {
  const groupRef = useRef<THREE.Group>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const { viewport, camera } = useThree()
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  
  // Animation properties
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0))
  const targetZoom = useRef(5) // Default camera z position
  const animating = useRef(false)

  // Load images and compute aspect ratios
  useEffect(() => {
    const loader = new THREE.TextureLoader()
    Promise.all(
      imagePaths.map(
        path =>
          new Promise<ImageData>((resolve) => {
            loader.load(path, (tex) => {
              // Force proper texture parameters for PNG transparency
              tex.premultiplyAlpha = true;
              tex.needsUpdate = true;
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              tex.magFilter = THREE.LinearFilter;
              
              const ratio = tex.image.width / tex.image.height
              resolve({ texture: tex, aspectRatio: ratio })
            })
          })
      )
    ).then(setImages)
  }, [imagePaths])
  
  // Handle animation of camera position
  useFrame(() => {
    if (animating.current) {
      // Smoothly interpolate camera position
      camera.position.lerp(new THREE.Vector3(
        targetPosition.current.x,
        targetPosition.current.y,
        targetZoom.current
      ), 0.1)
      
      // Check if we're close enough to target to stop animating
      if (camera.position.distanceTo(new THREE.Vector3(
        targetPosition.current.x,
        targetPosition.current.y,
        targetZoom.current
      )) < 0.01) {
        animating.current = false
      }
    }
  })

  // Function to handle image click
  const handleImageClick = (index: number, position: THREE.Vector3) => {
    if (!allowInteraction || wasRotating) return;
    // If clicking the same image while zoomed, reset to original view
    if (focusedIndex === index) {
      targetPosition.current.set(0, 0, 0)
      targetZoom.current = 5
      setFocusedIndex(null)
    } else {
      // Zoom to the clicked image
      targetPosition.current.copy(position)
      targetZoom.current = 3 // Closer zoom level
      setFocusedIndex(index)
    }
    animating.current = true
  }
  
  // Handle click outside to reset zoom
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!allowInteraction || wasRotating) return;
      if (focusedIndex !== null) {
        // Convert to normalized coordinates
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1, 
          -(e.clientY / window.innerHeight) * 2 + 1
        )
        
        // Raycaster to check what we're clicking on
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, camera)
        
        // Check if we clicked on any mesh
        const intersects = raycaster.intersectObjects(groupRef.current?.children || [])
        
        // If we didn't click on an image, reset the view
        if (intersects.length === 0) {
          targetPosition.current.set(0, 0, 0)
          targetZoom.current = 5
          setFocusedIndex(null)
          animating.current = true
        }
      }
    }
    
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [focusedIndex, camera, allowInteraction, wasRotating])

  if (images.length === 0) return null

  const isLandscape = viewport.width > viewport.height
  const spacing = isLandscape ? 0.7 : 0.4  // Different spacing based on orientation
  const total = images.length

  // Fixed axis size (width in landscape, height in portrait)
  const availableSpace = isLandscape
    ? viewport.width * 0.9
    : viewport.height * 0.7

  // Calculate fixed width that will be used in both modes
  const baseWidth = (availableSpace - (total - 1) * spacing) / total

  // For top alignment in landscape mode, find the tallest image
  const maxHeight = Math.max(...images.map(img => baseWidth / img.aspectRatio));

  // Pre-compute all heights for portrait positioning
  const heights = images.map(img => baseWidth / img.aspectRatio);

  return (
    <group ref={groupRef} position={[0, verticalOffset, zPosition]}>
      {images.map(({ texture, aspectRatio }, i) => {
        // Always use fixed width
        const width = baseWidth;
        const height = width / aspectRatio;

        // Position calculation
        let xPos = 0;
        let yPos = 0;
        
        if (isLandscape) {
          // Horizontal layout - center horizontally
          xPos = (i - total / 2 + 0.5) * (width + spacing);
          
          // Top alignment - align all tops with the tallest image
          yPos = (maxHeight - height) / 2;
        } else {
          // Vertical layout - center horizontally
          xPos = 0;
          
          // Calculate position based on the heights of all previous images
          let offset = 0;
          
          // Calculate total height of all images plus spacing
          const totalHeight = heights.reduce((sum, h) => sum + h, 0) + (total - 1) * spacing;
          
          // Position starting from top
          offset = totalHeight / 2; // Start from the top edge
          
          // Subtract heights of all previous images and their spacing
          for (let j = 0; j < i; j++) {
            offset -= heights[j] + spacing;
          }
          
          // Adjust by half the current image height to position correctly
          offset -= height / 2;
          
          yPos = offset;
        }

        // Create the mesh position vector
        const position = new THREE.Vector3(xPos, yPos, 0);
        
        // Scale effect for the focused image
        const scale = focusedIndex === i ? 1.1 : 1.0;
        
        return (
          <mesh 
            key={i} 
            position={position}
            scale={[scale, scale, scale]}
            onClick={(e) => {
              e.stopPropagation(); // Prevent event bubbling
              handleImageClick(i, position);
            }}
          >
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial 
              map={texture} 
              transparent={true}
              side={THREE.DoubleSide}
              alphaTest={0.01}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function Scene() {
    const { scene, camera, gl } = useThree()
    const isDragging = useRef(false)
    const wasRotating = useRef(false)
    const lastPosition = useRef({ x: 0, y: 0 })
    const activeCube = useRef<THREE.Mesh | null>(null)
    // Add state to track if we should allow image interactions
    const allowImageInteraction = useRef(true)
    const imagePaths = [
    '/assets/first.png',
    '/assets/next.png',
    '/assets/then.png',
    '/assets/and.png',
    '/assets/fin.png',
  ]
  
  
  // Set up global event listeners
  useEffect(() => {
    const canvas = gl.domElement
    
    const handlePointerDown = (e: PointerEvent) => {
      isDragging.current = true
      wasRotating.current = false
      allowImageInteraction.current = true
      lastPosition.current = { x: e.clientX, y: e.clientY }
      
      // Create normalized mouse coordinates
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1, 
        -(e.clientY / window.innerHeight) * 2 + 1
      )
    
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      
      // Get all objects to test intersection with
      const objectsToTest = scene.children.flatMap(child => {
        if (child instanceof THREE.Group) {
          return child.children
        }
        return child
      })
      
      // Do the raycasting in world space
      const intersects = raycaster.intersectObjects(objectsToTest, false)
      
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
        activeCube.current.rotation.y += deltaX
        activeCube.current.rotation.x += deltaY
      } else {
        scene.rotation.y += deltaX
        scene.rotation.x += deltaY
        wasRotating.current = true
        allowImageInteraction.current = false
      }
    }
    
    const handlePointerUp = (e: PointerEvent) => {
      // Add delay before resetting wasRotating to prevent immediate zoom
      if (wasRotating.current) {
        setTimeout(() => {
          wasRotating.current = false
        }, 100) // Small delay to prevent immediate interaction
      }
      
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
      camera.position.z = Math.max(-5, Math.min(10, camera.position.z))
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
      <mesh userData={{ isBackground: true }} position={[0, 0, -10]} scale={[100, 100, 1]}>
        <planeGeometry />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Front layer */}
      <ResponsiveImageStrip
  imagePaths={imagePaths}
  allowInteraction={allowImageInteraction.current}
  wasRotating={wasRotating.current}
  zPosition={0}
/>
      {/* Back layer */}
      <ResponsiveImageStrip
  imagePaths={imagePaths}
  allowInteraction={allowImageInteraction.current}
  wasRotating={wasRotating.current}
  zPosition={-1}
/>

      <ambientLight intensity={4} />
      <pointLight position={[0, 0, 5]} />
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