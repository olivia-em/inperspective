import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ResponsiveImageStripProps {
  imagePaths: string[]
  maxSize?: number 
  verticalOffset?: number
  onReset?: () => void
}

interface ImageData {
  texture: THREE.Texture
  aspectRatio: number
}

export function ResponsiveImageStrip({ 
  imagePaths, 
  maxSize = 4,
  verticalOffset = 0,
  onReset
}: ResponsiveImageStripProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const { viewport, camera } = useThree()
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  
  // Animation properties
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0))
  const targetZoom = useRef(5) // Default camera z position
  const animating = useRef(false)
  
  // Drag tracking to prevent zoom on drag release
  const isDragging = useRef(false)
  const dragStartTime = useRef(0)
  
  // Function to reset all camera and rotation states
  const resetView = () => {
    // Reset camera position
    targetPosition.current.set(0, 0, 0)
    targetZoom.current = 5
    setFocusedIndex(null)
    animating.current = true
    
    // Reset all rotations if the scene object exists
    if (groupRef.current) {
      groupRef.current.rotation.set(0, 0, 0)
      
      // Reset rotations of all child meshes
      groupRef.current.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          child.rotation.set(0, 0, 0)
        }
      })
    }
  }
  
  // Expose reset function to parent component if provided
  useEffect(() => {
    if (onReset) {
      onReset = resetView
    }
  }, [onReset])

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

  // Function to handle image click (not drag)
  const handleImageClick = (index: number, position: THREE.Vector3, event: any) => {
    // Only trigger zoom if it's a click, not a drag release
    if (!isDragging.current || (Date.now() - dragStartTime.current < 150)) {
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
  }
  
  // Set up drag detection
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      isDragging.current = false
      dragStartTime.current = Date.now()
    }
    
    const handlePointerMove = (e: PointerEvent) => {
      // If pointer moved more than a few pixels, consider it a drag
      if (e.movementX > 3 || e.movementY > 3) {
        isDragging.current = true
      }
    }
    
    const handlePointerUp = (e: PointerEvent) => {
      // If we were dragging and enough time passed, don't trigger click/zoom
      if (isDragging.current && (Date.now() - dragStartTime.current > 150)) {
        isDragging.current = false
        return
      }
      
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
      
      isDragging.current = false
    }
    
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [focusedIndex, camera])

  if (images.length === 0) return null

  const isLandscape = viewport.width > viewport.height
  const spacing = isLandscape ? 0.7 : 0.4  // Different spacing based on orientation
  const total = images.length

  // Fixed axis size (width in landscape, height in portrait)
  const availableSpace = isLandscape
    ? viewport.width * 0.9
    : viewport.height * 0.9

  // Calculate fixed width that will be used in both modes
  const baseWidth = (availableSpace - (total - 1) * spacing) / total

  // For top alignment in landscape mode, find the tallest image
  const maxHeight = Math.max(...images.map(img => baseWidth / img.aspectRatio));

  // Pre-compute all heights for portrait positioning
  const heights = images.map(img => baseWidth / img.aspectRatio);

  return (
    <group ref={groupRef} position={[0, verticalOffset, 0]}>
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
              handleImageClick(i, position, e);
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

// The main component with a reset button
export default function ImageGallery() {
  const resetRef = useRef<() => void>(() => {});
  
  // Function to call the reset function exposed by ResponsiveImageStrip
  const handleReset = () => {
    if (resetRef.current) {
      resetRef.current();
    }
  };
  
  // Sample image paths
  const imagePaths = [
    '/assets/first.png',
    '/assets/next.png',
    '/assets/then.png',
    '/assets/and.png',
    '/assets/fin.png',
  ];

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0, 5] }}>
        <Scene imagePaths={imagePaths} onResetRef={resetRef} />
      </Canvas>
      
      {/* Reset button positioned at the top-right corner */}
      <button
        onClick={handleReset}
        style={{
          position: 'absolute',
          top: '15px',
          right: '15px',
          zIndex: 100,
          padding: '8px 16px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}
      >
        Reset View
      </button>
    </div>
  );
}

// Scene component that forwards the reset ref
function Scene({ imagePaths, onResetRef }: { imagePaths: string[], onResetRef: React.MutableRefObject<() => void> }) {
  const resetHandler = () => {
    // This function will be populated by the ResponsiveImageStrip
  };
  
  // Store the reset function when the component mounts
  useEffect(() => {
    onResetRef.current = resetHandler;
  }, [onResetRef]);
  
  return (
    <>
      <ResponsiveImageStrip 
        imagePaths={imagePaths} 
        verticalOffset={1.0}
        onReset={resetHandler}
      />
      <ambientLight intensity={4} />
      <pointLight position={[0, 0, 0]} />
    </>
  );
}