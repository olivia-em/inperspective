import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ImageState {
  rotation: THREE.Euler
  position: THREE.Vector3
  isActive: boolean
}

interface ImageData {
  texture: THREE.Texture
  aspectRatio: number
}

interface ResponsiveImageStripProps {
  imagePaths: string[]
  maxSize?: number 
  verticalOffset?: number
  wasRotating: boolean 
  allowInteraction?: boolean
  zPosition?: number
  imageStates: ImageState[]
  onRotate?: (index: number, deltaX: number, deltaY: number) => void
  isBackLayer: boolean
}

export function ResponsiveImageStrip({ 
  imagePaths, 
  maxSize = 4,
  verticalOffset = 0,
  allowInteraction = true,
  wasRotating = false,
  zPosition = 0,
  imageStates,
  onRotate,
  isBackLayer
}: ResponsiveImageStripProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [images, setImages] = useState<ImageData[]>([])
  const { viewport, camera } = useThree()
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  
  // Animation properties
  const targetPosition = useRef(new THREE.Vector3(0, 0, 0))
  const targetZoom = useRef(5) // Default camera z position
  const animating = useRef(false)
  const interactionEnabled = useRef(true)
  const interactionTimer = useRef<NodeJS.Timeout | null>(null)

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
  
  // Update interaction state based on wasRotating prop
  useEffect(() => {
    // Clear any existing timers to prevent multiple timers
    if (interactionTimer.current) {
      clearTimeout(interactionTimer.current)
    }
    
    if (wasRotating) {
      interactionEnabled.current = false;
      // Re-enable interaction after a delay
      interactionTimer.current = setTimeout(() => {
        interactionEnabled.current = true;
      }, 300);
    } else {
      // Always ensure interaction is enabled when not rotating
      interactionEnabled.current = true;
    }
    
    return () => {
      if (interactionTimer.current) {
        clearTimeout(interactionTimer.current);
      }
    };
  }, [wasRotating]);
  
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
  const handleImageClick = (index: number, position: THREE.Vector3, isBack: boolean) => {
    // Debug console to verify click is registered
    console.log("Image clicked:", index, "interaction enabled:", interactionEnabled.current);
    
    if (!interactionEnabled.current) {
      console.log("Interaction disabled, ignoring click");
      return;
    }

    if (focusedIndex === index) {
      targetPosition.current.set(0, 0, 0)
      // Different reset zoom based on layer
      targetZoom.current = isBack ? 8 : 5  // Back layer resets to max zoom out
      setFocusedIndex(null)
    } else {
      targetPosition.current.copy(position)
      // Different zoom levels for front and back layers
      targetZoom.current = isBack ? 6 : 3
      setFocusedIndex(index)
    }
    animating.current = true
  }

  // Update click outside handler
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!interactionEnabled.current) return;
      
      if (focusedIndex !== null) {
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1, 
          -(e.clientY / window.innerHeight) * 2 + 1
        )
        
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera(mouse, camera)
        
        const intersects = raycaster.intersectObjects(groupRef.current?.children || [])
        
        if (intersects.length === 0) {
          targetPosition.current.set(0, 0, 0)
          // Different reset zoom based on layer
          targetZoom.current = isBackLayer ? 10 : 5  // Back layer resets to max zoom out
          setFocusedIndex(null)
          animating.current = true
        }
      }
    }
    
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [focusedIndex, camera, isBackLayer]);

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

        let position: THREE.Vector3;

        if (isBackLayer) {
          // Ellipse dimensions (adjust to wrap around the front layer)
          const ellipseWidth = availableSpace * 1
          const ellipseHeight = maxHeight * 7
          
          // Add rotation offset to shift starting position (adjust this value to rotate more/less)
          const rotationOffset = Math.PI * 0.5 // Shifts by 90 degrees
          
          const angle = (i / total) * Math.PI * 2 + rotationOffset
          
          // Optional: tilt the ellipse by applying a rotation matrix
          const tiltAngle = Math.PI * 0.0 // Adjust this value for more/less tilt
          position = new THREE.Vector3(
            Math.cos(angle) * (ellipseWidth / 2),
            Math.sin(angle) * (ellipseHeight / 2),
            zPosition
          ).applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltAngle)
        } else {
          position = new THREE.Vector3(xPos, yPos, zPosition)
        }

        // Scale effect for the focused image
        const scale = isBackLayer ? 
          (focusedIndex === i ? 1.6 : 1.5) : // Larger scale for back layer
          (focusedIndex === i ? 1.1 : 1.0);   // Original scale for front layer
      
        return (
          <mesh 
            key={i} 
            position={position}
            rotation={isBackLayer ? new THREE.Euler(0, 0, 0) : imageStates[i].rotation}
            scale={[scale, scale, scale]}
            userData={{ 
              index: i, 
              basePosition: position.clone(), 
              layer: isBackLayer ? 'back' : 'front' 
            }}
            onClick={(e) => {
              e.stopPropagation();
              console.log(`Click on image ${i}, layer: ${isBackLayer ? 'back' : 'front'}`);
              const basePosition = e.object.userData.basePosition;
              handleImageClick(i, basePosition, isBackLayer);
            }}
          >
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial 
              map={texture} 
              transparent={true}
              side={THREE.DoubleSide}
              alphaTest={0.01}
              depthWrite={false}
              // blending={THREE.CustomBlending}
              // blendEquation={THREE.AddEquation}
              // blendSrc={THREE.OneMinusDstColorFactor}
              // blendDst={THREE.OneMinusSrcColorFactor}
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
  const [wasRotatingState, setWasRotatingState] = useState(false)
  const wasRotating = useRef(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  const dragStartTime = useRef(0)
  const dragDistance = useRef({ x: 0, y: 0 })
  const activeCube = useRef<THREE.Mesh | null>(null)
  const allowImageInteraction = useRef(true)
  const interactionResetTimer = useRef<NodeJS.Timeout | null>(null)

  // Move imagePaths declaration before it's used
  const imagePaths = [
    '/assets/first.png',
    '/assets/next.png',
    '/assets/then.png',
    '/assets/and.png',
    '/assets/fin.png',
  ]

  const backImagePaths = [
    '/assets/first-sub.png',
    '/assets/next-sub.png',
    '/assets/then-sub.png',
    '/assets/and-sub.png',
    '/assets/fin-sub.png',
  ]

  const pentagonOrder = [2, 0, 1, 3, 4] // your custom order for 5 images
  const backLayerImagePaths = pentagonOrder.map(i => backImagePaths[i])

  // Add image states
  const [imageStates, setImageStates] = useState<ImageState[]>(() => 
    Array(5).fill(null).map(() => ({
      rotation: new THREE.Euler(0, 0, 0),
      position: new THREE.Vector3(0, 0, 0),
      isActive: false
    }))
  )

  const backLayerStates = pentagonOrder.map(i => imageStates[i])
  const getBackPosition = (rotation: THREE.Euler, basePosition: THREE.Vector3) => {
    const maxOffset = 3 // Increased from 0.5 for more dramatic movement
    return new THREE.Vector3(
      basePosition.x + Math.sin(rotation.y) * maxOffset,
      basePosition.y + Math.sin(rotation.x) * maxOffset,
      -1
    )
  }
  
  // Reset wasRotating state and ensure interaction is enabled after rotation
  useEffect(() => {
    // Clear any existing timer to prevent multiple timers
    if (interactionResetTimer.current) {
      clearTimeout(interactionResetTimer.current);
    }
    
    if (wasRotatingState) {
      // Set a timer to reset the rotation state
      interactionResetTimer.current = setTimeout(() => {
        setWasRotatingState(false);
        wasRotating.current = false;
        allowImageInteraction.current = true;
        console.log("Rotation state reset, interactions enabled");
      }, 300);
    }
    
    return () => {
      if (interactionResetTimer.current) {
        clearTimeout(interactionResetTimer.current);
      }
    };
  }, [wasRotatingState]);

  const handleImageRotation = (index: number, deltaX: number, deltaY: number, basePosition: THREE.Vector3) => {
    setImageStates(prev => prev.map((state, i) => {
      if (i === index) {
        const newRotation = new THREE.Euler(
          state.rotation.x + deltaY,
          state.rotation.y + deltaX,
          0
        )
        return {
          ...state,
          rotation: newRotation,
          position: getBackPosition(newRotation, basePosition)
        }
      }
      return state
    }))
  }

  useEffect(() => {
    const canvas = gl.domElement
    
    const handlePointerDown = (e: PointerEvent) => {
      isDragging.current = true
      wasRotating.current = false
      lastPosition.current = { x: e.clientX, y: e.clientY }
      dragStartTime.current = Date.now()
      dragDistance.current = { x: 0, y: 0 }
      
      const mouse = new THREE.Vector2(
        (e.clientX / window.innerWidth) * 2 - 1, 
        -(e.clientY / window.innerHeight) * 2 + 1
      )
    
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      
      const objectsToTest = scene.children.flatMap(child => {
        if (child instanceof THREE.Group) {
          return child.children
        }
        return child
      })
      
      const intersects = raycaster.intersectObjects(objectsToTest, false)
      
      const clickedMesh = intersects.find(
        (obj) => obj.object instanceof THREE.Mesh &&
                 obj.object.userData.index !== undefined
      )
      
      if (clickedMesh && clickedMesh.object instanceof THREE.Mesh) {
        activeCube.current = clickedMesh.object
        // If we clicked on an image, this is not scene rotation
        wasRotating.current = false
        setWasRotatingState(false)
      } else {
        activeCube.current = null
      }
    }
    
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return
      
      const deltaX = (e.clientX - lastPosition.current.x) * 0.01
      const deltaY = (e.clientY - lastPosition.current.y) * 0.01
      
      // Update drag distance for click vs. drag detection
      dragDistance.current.x += Math.abs(e.clientX - lastPosition.current.x)
      dragDistance.current.y += Math.abs(e.clientY - lastPosition.current.y)
      
      lastPosition.current = { x: e.clientX, y: e.clientY }
      
      if (activeCube.current) {
        const index = activeCube.current.userData.index
        const basePosition = activeCube.current.position
        if (activeCube.current?.userData.layer !== 'front') return;
        handleImageRotation(index, deltaX, deltaY, basePosition)
      } else {
        // Only rotate the scene if we've moved more than a minimum threshold
        if (dragDistance.current.x > 5 || dragDistance.current.y > 5) {
          scene.rotation.y += deltaX
          scene.rotation.x += deltaY
          wasRotating.current = true
          setWasRotatingState(true)
          allowImageInteraction.current = false
        }
      }
    }
    
    const handlePointerUp = (e: PointerEvent) => {
      const dragDuration = Date.now() - dragStartTime.current
      const dragTotalDistance = dragDistance.current.x + dragDistance.current.y
      
      // Consider it a click only if drag was short in time and distance
      const isClick = dragDuration < 200 && dragTotalDistance < 10
      
      if (!isClick && wasRotating.current) {
        wasRotating.current = true
        setWasRotatingState(true)
        console.log("Finished rotating scene, temporarily disabling interactions");
      } else if (isClick) {
        // This was a clean click, always enable interaction for clicks
        wasRotating.current = false;
        setWasRotatingState(false);
        allowImageInteraction.current = true;
        console.log("Clean click detected, enabling interactions");
      }
      
      isDragging.current = false
      activeCube.current = null
    }
    
    // Force enable interaction when user does a click with no drag
    const handleClick = (e: MouseEvent) => {
      if (!wasRotating.current && dragDistance.current.x < 5 && dragDistance.current.y < 5) {
        wasRotating.current = false;
        setWasRotatingState(false);
        allowImageInteraction.current = true;
        console.log("Click detected, enabling interactions");
      }
    }
    
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      // Only allow zoom if not rotating
      if (!wasRotating.current) {
        const zoomSpeed = 0.1
        const delta = e.deltaY > 0 ? 1 : -1
        camera.position.z += delta * zoomSpeed
        camera.position.z = Math.max(-5, Math.min(10, camera.position.z))
      }
    }
    
    // Double-click to reset rotation and interaction state
    const handleDoubleClick = () => {
      scene.rotation.set(0, 0, 0)
      wasRotating.current = false
      setWasRotatingState(false)
      allowImageInteraction.current = true
      console.log("Double-click detected, resetting scene and enabling interactions");
    }
    
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('click', handleClick)
    window.addEventListener('dblclick', handleDoubleClick)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('click', handleClick)
      window.removeEventListener('dblclick', handleDoubleClick)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [scene, camera, gl])
  
  // Debugging helper
  useFrame(() => {
    if (wasRotating.current !== wasRotatingState) {
      console.log(`wasRotating ref (${wasRotating.current}) and state (${wasRotatingState}) are out of sync`);
    }
  })
  
  return (
    <>
      <mesh userData={{ isBackground: true }} position={[0, 0, -10]} scale={[100, 100, 1]}>
        <planeGeometry />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <ResponsiveImageStrip
        imagePaths={imagePaths}
        allowInteraction={allowImageInteraction.current}
        zPosition={0}
        imageStates={imageStates}
        onRotate={handleImageRotation}
        wasRotating={wasRotatingState}
        isBackLayer={false}
      />

      <ResponsiveImageStrip
        imagePaths={backLayerImagePaths} 
        allowInteraction={allowImageInteraction.current}
        wasRotating={wasRotatingState}
        zPosition={2} 
        imageStates={backLayerStates}
        isBackLayer={true}
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