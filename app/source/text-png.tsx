import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// First, update the interfaces to handle both media types
interface MediaState {
    rotation: THREE.Euler
    position: THREE.Vector3
    isActive: boolean
    letterSpacing?: number  // Add these new parameters
    lineHeight?: number
  }
  interface ImageData {
    texture: THREE.Texture
    aspectRatio: number
  }
  
  interface TextData {
    text: string
    width: number
    height: number
  }
  
  const ZOOM_LEVELS = {
    // Max zoom out (overview of entire scene)
    overview: {
      landscape: 10,
      portrait: 12
    },
    // Focus on back layer
    backLayer: {
      landscape: 6,
      portrait: 4
    },
    // Focus on front layer
    frontLayer: {
      landscape: 3,
      portrait: 2
    }
  };
  
  // Helper function to get the appropriate zoom level based on context
  const getZoomLevel = (context: {
    layer: 'overview' | 'frontLayer' | 'backLayer',
    isLandscape: boolean
  }) => {
    return ZOOM_LEVELS[context.layer][context.isLandscape ? 'landscape' : 'portrait'];
  };
  

interface ResponsiveImageStripProps {
  imagePaths: string[]
  maxSize?: number 
  verticalOffset?: number
  wasRotating: boolean 
  allowInteraction?: boolean
  zPosition?: number
  mediaStates: MediaState[]
  onRotate?: (index: number, deltaX: number, deltaY: number, basePosition: THREE.Vector3) => void
  isBackLayer: boolean
}

interface ResponsiveTextStripProps {
  textContents: string[]
  maxSize?: number 
  verticalOffset?: number
  wasRotating: boolean 
  allowInteraction?: boolean
  zPosition?: number
  mediaStates: MediaState[]
  onRotate?: (index: number, deltaX: number, deltaY: number, basePosition: THREE.Vector3) => void
  isBackLayer: boolean
  textColor?: string
  backgroundColor?: string
  fontSize?: number
}

// Helper function to create text textures
const createTextTexture = (
    text: string, 
    fontSize = 100,
    color = '#000000', 
    bgColor = 'rgba(0,0,0,0)',
    maxWidth = 500,
    letterSpacing = 0,
    lineHeight = 1.5
  ) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
  
    // Set font for measurements
    ctx.font = `${fontSize}px Arial, sans-serif`
    
    // Calculate wrapped text with letter spacing
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = words[0]
  
    // Apply letter spacing to measurement
    const getTextWidth = (text: string) => {
      const originalWidth = ctx.measureText(text).width
      return originalWidth + (text.length - 1) * letterSpacing
    }
  
    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i]
      if (getTextWidth(testLine) > maxWidth) {
        lines.push(currentLine)
        currentLine = words[i]
      } else {
        currentLine = testLine
      }
    }
    lines.push(currentLine)
  
    // Calculate dimensions with adjusted line height
    const padding = fontSize
    const adjustedLineHeight = fontSize * lineHeight
    const width = maxWidth + padding * 2
    const height = Math.ceil(adjustedLineHeight * lines.length + padding * 2)
    
    canvas.width = width
    canvas.height = height
    
    // Draw text with letter spacing and line height
    ctx.font = `${fontSize}px Arial, sans-serif`
    // ctx.fillStyle = color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    lines.forEach((line, i) => {
      const y = padding + (i * adjustedLineHeight) + adjustedLineHeight / 2
      // Draw each character with spacing
      let x = width / 2 - getTextWidth(line) / 2
      for (let char of line) {
        ctx.fillText(char, x, y)
        x += ctx.measureText(char).width + letterSpacing
      }
    })
    
    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    
    return {
      texture,
      aspectRatio: width / height,
      width,
      height
    }
  }

// Image Strip Component
export function ResponsiveImageStrip({ 
  imagePaths, 
  maxSize = 4,
  verticalOffset = 0,
  allowInteraction = true,
  wasRotating = false,
  zPosition = 0,
  mediaStates,
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
      }, 1000);
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
  const handleMediaClick = (index: number, position: THREE.Vector3, isBack: boolean) => {
    const isLandscape = viewport.width > viewport.height;
    
    if (focusedIndex === index) {
      // Reset to overview
      targetPosition.current.set(0, 0, 0);
      targetZoom.current = getZoomLevel({ 
        layer: 'overview', 
        isLandscape 
      });
      setFocusedIndex(null);
    } else {
      // Focus on item
      targetPosition.current.copy(position);
      targetZoom.current = getZoomLevel({ 
        layer: isBack ? 'backLayer' : 'frontLayer', 
        isLandscape 
      });
      setFocusedIndex(index);
    }
    animating.current = true;
  };
  

  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (!interactionEnabled.current) return;
      
      if (focusedIndex !== null) {
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1, 
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        const intersects = raycaster.intersectObjects(groupRef.current?.children || []);
        
        if (intersects.length === 0) {
          targetPosition.current.set(0, 0, 0);
          const isLandscape = viewport.width > viewport.height;
          targetZoom.current = getZoomLevel({ 
            layer: 'overview', 
            isLandscape 
          });
          setFocusedIndex(null);
          animating.current = true;
        }
      }
    };
    
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [focusedIndex, camera, viewport.width, viewport.height]);
  

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
          const ellipseWidth = availableSpace * 2.5
          const ellipseHeight = maxHeight * 15
          
          // Add rotation offset to shift starting position
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
          (focusedIndex === i ? 1.2 : 1.0) : // Slight scale increase for back layer
          (focusedIndex === i ? 1.1 : 1.0);   // Original scale for front layer
      
        return (
          <mesh 
            key={i} 
            position={position}
            rotation={isBackLayer ? new THREE.Euler(0, 0, 0) : mediaStates[i].rotation}
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
              handleMediaClick(i, basePosition, isBackLayer);
              if (onRotate && e.object.userData.layer === 'front') {
                onRotate(i, 0, 0, basePosition);
              }
            }}
          >
            <planeGeometry args={[width, height]} />
            <meshBasicMaterial 
              map={texture} 
              transparent={true}
              side={THREE.DoubleSide}
              alphaTest={0.01}
              depthWrite={false}
              blending={THREE.CustomBlending}
              blendEquation={THREE.AddEquation}
              blendSrc={THREE.OneMinusDstColorFactor}
              blendDst={THREE.OneMinusSrcColorFactor}
            />
          </mesh>
        )
      })}
    </group>
  )
}

// Text Strip Component
export function ResponsiveTextStrip({ 
    textContents, 
    verticalOffset = 0,
    wasRotating = false,
    zPosition = 0,
    mediaStates,
    onRotate,
    isBackLayer,
    textColor = '#ffffff',
    backgroundColor = 'rgba(0,0,0,0)',
    fontSize = 48
  }: ResponsiveTextStripProps) {
    const groupRef = useRef<THREE.Group>(null)
    const [texts, setTexts] = useState<TextData[]>([])
    const { viewport, camera } = useThree()
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
    
    // Animation properties
    const targetPosition = useRef(new THREE.Vector3(0, 0, 0))
    const targetZoom = useRef(5) // Default camera z position
    const animating = useRef(false)
    const interactionEnabled = useRef(true)
    const interactionTimer = useRef<NodeJS.Timeout | null>(null)
  
    // Create text textures
    useEffect(() => {
      const textData = textContents.map(text => {
        const result = createTextTexture(text, fontSize, textColor, backgroundColor)
        if (!result) {
          return { text, width: 2, height: 2 }
        }
        return { 
          text,
          width: result.width / 100, // Scale down canvas dimensions
          height: result.height / 100
        }
      })
      setTexts(textData)
    }, [textContents, fontSize, textColor, backgroundColor])
    
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
        }, 1000);
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
  
    // Function to handle text panel click
   // In ResponsiveTextStrip component
   const handleMediaClick = (index: number, position: THREE.Vector3, isBack: boolean) => {
    const isLandscape = viewport.width > viewport.height;
    
    if (focusedIndex === index) {
      // Reset to overview
      targetPosition.current.set(0, 0, 0);
      targetZoom.current = getZoomLevel({ 
        layer: 'overview', 
        isLandscape 
      });
      setFocusedIndex(null);
    } else {
      // Focus on item
      targetPosition.current.copy(position);
      targetZoom.current = getZoomLevel({ 
        layer: isBack ? 'backLayer' : 'frontLayer', 
        isLandscape 
      });
      setFocusedIndex(index);
    }
    animating.current = true;
  };
  
    // Update click outside handler
   // In ResponsiveTextStrip component, update the handlePointerDown useEffect
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
        // Different reset zoom based on layer and orientation
        const isLandscape = viewport.width > viewport.height
        targetZoom.current = isLandscape ? 10 : 5  // 10 for landscape, 5 for portrait
        setFocusedIndex(null)
        animating.current = true
      }
    }
  }
  
  window.addEventListener('pointerdown', handlePointerDown)
  return () => window.removeEventListener('pointerdown', handlePointerDown)
}, [focusedIndex, camera, isBackLayer, viewport.width, viewport.height])
  
    if (texts.length === 0) return null
  
    const isLandscape = viewport.width > viewport.height
    const spacing = isLandscape ? 0.7 : 0.4  // Different spacing based on orientation
    const total = texts.length
  
    // Fixed axis size (width in landscape, height in portrait)
    const availableSpace = isLandscape
      ? viewport.width * 0.9
      : viewport.height * 0.7
  
    // Calculate fixed width that will be used in both modes
    const baseWidth = (availableSpace - (total - 1) * spacing) / total
  
    // For top alignment in landscape mode, find the tallest text panel
    const maxHeight = Math.max(...texts.map(text => baseWidth / 2)); // Assuming 2:1 aspect ratio
  
    // Pre-compute all heights for portrait positioning
    const heights = texts.map(text => baseWidth / 2); // Assuming 2:1 aspect ratio
  
    return (
        <group ref={groupRef} position={[0, verticalOffset, zPosition]}>
          {texts.map((textData, i) => {
            // Get corresponding image rotation values
            const imageRotation = mediaStates[i].rotation
            
            // Map rotation values to text parameters (similar to p5.js example)
            const rotationX = Math.abs(Math.sin((imageRotation.x % (Math.PI * 2)) / 2))
            const rotationY = Math.abs(Math.sin((imageRotation.y % (Math.PI * 2)) / 2))
            
            // Map to letter spacing and line height
            const letterSpacing = THREE.MathUtils.lerp(-10, 15, rotationX)
            const lineHeight = THREE.MathUtils.lerp(0.1, 2, rotationY)
      
            // Create text texture with mapped parameters
            const textRender = createTextTexture(
              textData.text,
              fontSize,
              textColor,
              backgroundColor,
              500, // maxWidth
              letterSpacing,
              lineHeight
            )
          // Use fixed width and height for text panels
          const width = baseWidth;
          const height = width / 2; // Assuming 2:1 aspect ratio for text panels
  
          // Position calculation
          let xPos = 0;
          let yPos = 0;
          
          if (isLandscape) {
            // Horizontal layout - center horizontally
            xPos = (i - total / 2 + 0.5) * (width + spacing);
            
            // Top alignment - align all tops with the tallest panel
            yPos = (maxHeight - height) / 2;
          } else {
            // Vertical layout - center horizontally
            xPos = 0;
            
            // Calculate position based on the heights of all previous panels
            let offset = 0;
            
            // Calculate total height of all panels plus spacing
            const totalHeight = heights.reduce((sum, h) => sum + h, 0) + (total - 1) * spacing;
            
            // Position starting from top
            offset = totalHeight / 2; // Start from the top edge
            
            // Subtract heights of all previous panels and their spacing
            for (let j = 0; j < i; j++) {
              offset -= heights[j] + spacing;
            }
            
            // Adjust by half the current panel height to position correctly
            offset -= height / 2;
            
            yPos = offset;
          }
  
          let position: THREE.Vector3;
          if (isBackLayer) {
            // Ellipse dimensions that switch based on orientation
            const ellipseWidth = isLandscape 
              ? availableSpace * 2.5  // Landscape mode
              : maxHeight * 40        // Portrait mode
            
            const ellipseHeight = isLandscape 
              ? maxHeight * 15       // Landscape mode
              : availableSpace * 1.0 // Portrait mode
            
            // Rotation offset shifts by different amounts based on orientation
            const rotationOffset = isLandscape
              ? Math.PI * 0.5       // Landscape: 90 degrees
              : Math.PI * -0.4       // Portrait: 180 degrees
            
            const angle = (i / total) * Math.PI * 2 + rotationOffset
            
            // Apply additional rotation for portrait mode
            const portraitRotation = isLandscape 
              ? 0 
              : Math.PI * 0.5  // 90 degrees right rotation in portrait
            
            position = new THREE.Vector3(
              Math.cos(angle) * (ellipseWidth / 2),
              Math.sin(angle) * (ellipseHeight / 2),
              zPosition
            ).applyAxisAngle(new THREE.Vector3(0, 0, 1), portraitRotation)
          }
  
          // Scale effect for the focused panel
          const scale = isBackLayer ? 
            (focusedIndex === i ? 4 : 4) : // Larger scale for back layer
            (focusedIndex === i ? 1.1 : 1.0);   // Original scale for front layer
  
        
          return (
            <mesh 
              key={i} 
              position={position}
              rotation={isBackLayer ? new THREE.Euler(0, 0, 0) : mediaStates[i].rotation}
              scale={[scale, scale, scale]}
              userData={{ 
                index: i, 
                basePosition: position.clone(), 
                layer: isBackLayer ? 'back' : 'front' 
              }}
              onClick={(e) => {
                e.stopPropagation();
                console.log(`Click on text panel ${i}, layer: ${isBackLayer ? 'back' : 'front'}`);
                const basePosition = e.object.userData.basePosition;
                handleMediaClick(i, basePosition, isBackLayer);
                if (onRotate && e.object.userData.layer === 'front') {
                  onRotate(i, 0, 0, basePosition);
                }
              }}
            >
              <planeGeometry args={[width, height]} />
              {textRender ? (
                <meshBasicMaterial 
                  map={textRender.texture} 
                  transparent={true}
                  side={THREE.DoubleSide}
                  alphaTest={0.01}
                  depthWrite={false}
                  blending={THREE.CustomBlending}
                  blendEquation={THREE.AddEquation}
                  blendSrc={THREE.OneMinusDstColorFactor}
                  blendDst={THREE.OneMinusSrcColorFactor}
                />
              ) : (
                <meshBasicMaterial 
                  color={backgroundColor} 
                  transparent={true}
                  side={THREE.DoubleSide}
                >
                  {/* Fallback if texture creation fails */}
                </meshBasicMaterial>
              )}
            </mesh>
          )
        })}
      </group>
    )
  }

// Main Scene Component
function Scene() {
  const { scene, camera, gl, viewport } = useThree()
  const isDragging = useRef(false)
  const [wasRotatingState, setWasRotatingState] = useState(false)
  const wasRotating = useRef(false)
  const lastPosition = useRef({ x: 0, y: 0 })
  const dragStartTime = useRef(0)
  const dragDistance = useRef({ x: 0, y: 0 })
  const activePanel = useRef<THREE.Mesh | null>(null)
  const allowInteraction = useRef(true)
  const interactionResetTimer = useRef<NodeJS.Timeout | null>(null)
  

  // Define front image paths
  const imagePaths = [
    '/assets/first.png',
    '/assets/next.png',
    '/assets/then.png',
    '/assets/and.png',
    '/assets/fin.png',
  ]

  // Back layer - Text content
  const backTextContents = [
    'I hadn’t known it was a tug of war, until I woke up on his playing field finding nothing I could grasp. When I looked back at myself, all I saw was rope.',
    'Before you, the only false prophet I’d met was at the head of a childhood dinner table. I feel knee-high again and totally agnostic.',
    'I’d never felt so degraded as when I begged to follow someone lost. And then you crueler: to not admit where you stood on me, but expect I shed your weight alone.',
    'The night I attended the death of respect among bean bags on the floor, I spiraled home alone. My depth had only gone so far as my body, but icon or object… I hadn’t known. Like with him, there won’t be hauntings, but I’ll gladly be a ghost.',
    'I used to have a friend who double-crossed me out of spite; the resemblance is uncanny, like how you stare when someone cries.'
  ]

  const pentagonOrder = [2, 0, 1, 3, 4]
  const backLayerTextContents = pentagonOrder.map(i => backTextContents[i])

  // Shared state for both layers
  const [mediaStates, setMediaStates] = useState<MediaState[]>(() => 
    Array(5).fill(null).map(() => ({
      rotation: new THREE.Euler(0, 0, 0),
      position: new THREE.Vector3(0, 0, 0),
      isActive: false
    }))
  )

  const backLayerStates = pentagonOrder.map(i => mediaStates[i])

  const ZOOM_LEVELS = {
    // Max zoom out (overview of entire scene)
    overview: {
      landscape: 10,
      portrait: 12
    },
    // Focus on back layer
    backLayer: {
      landscape: 6,
      portrait: 4
    },
    // Focus on front layer
    frontLayer: {
      landscape: 3,
      portrait: 2
    }
  };
  
  // Helper function to get the appropriate zoom level based on context
  const getZoomLevel = (context: {
    layer: 'overview' | 'frontLayer' | 'backLayer',
    isLandscape: boolean
  }) => {
    return ZOOM_LEVELS[context.layer][context.isLandscape ? 'landscape' : 'portrait'];
  };


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
        allowInteraction.current = true;
        console.log("Rotation state reset, interactions enabled");
      }, 300);
    }
    
    return () => {
      if (interactionResetTimer.current) {
        clearTimeout(interactionResetTimer.current);
      }
    };
  }, [wasRotatingState]);

  // Update the handleMediaRotation function to work with both types:
const handleMediaRotation = (index: number, deltaX: number, deltaY: number, basePosition: THREE.Vector3) => {
    setMediaStates(prev => prev.map((state, i) => {
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
  
  // Update pointer handlers to handle both types:
  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging.current) return
    
    const deltaX = (e.clientX - lastPosition.current.x) * 0.01
    const deltaY = (e.clientY - lastPosition.current.y) * 0.01
    
    dragDistance.current.x += Math.abs(e.clientX - lastPosition.current.x)
    dragDistance.current.y += Math.abs(e.clientY - lastPosition.current.y)
    
    lastPosition.current = { x: e.clientX, y: e.clientY }
    
    if (activePanel.current) {
      const index = activePanel.current.userData.index
      const basePosition = activePanel.current.userData.basePosition
      if (activePanel.current?.userData.layer !== 'front') return
      handleMediaRotation(index, deltaX, deltaY, basePosition)
    } else {
      if (dragDistance.current.x > 5 || dragDistance.current.y > 5) {
        scene.rotation.y += deltaX
        scene.rotation.x += deltaY
        wasRotating.current = true
        setWasRotatingState(true)
        allowInteraction.current = false
      }
    }
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
        activePanel.current = clickedMesh.object
        // If we clicked on a panel, this is not scene rotation
        wasRotating.current = false
        setWasRotatingState(false)
      } else {
        activePanel.current = null
      }
    }
        
        // In the Scene component, change handlePointerUp:
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
    allowInteraction.current = true;
    console.log("Clean click detected, enabling interactions");
  }
  
  isDragging.current = false
  activePanel.current = null  // Changed from activeCube to activePanel
}
        // Force enable interaction when user does a click with no drag
        const handleMediaClick = (e: MouseEvent) => {
          if (!wasRotating.current && dragDistance.current.x < 5 && dragDistance.current.y < 5) {
            wasRotating.current = false;
            setWasRotatingState(false);
            allowInteraction.current = true;
            console.log("Click detected, enabling interactions");
          }
        }
        
        const handleDoubleClick = () => {
          scene.rotation.set(0, 0, 0);
          const isLandscape = viewport.width > viewport.height;
          
          // Reset camera position and zoom
          targetPosition.current.set(0, 0, 0);
          targetZoom.current = getZoomLevel({ 
            layer: 'overview', 
            isLandscape 
          });
          animating.current = true;
          
          wasRotating.current = false;
          setWasRotatingState(false);
          allowInteraction.current = true;
          setFocusedIndex(null);
          
          console.log("Double-click detected, resetting scene and enabling interactions");
        };
        
        // 5. Also update the wheel handler to respect the same min/max bounds:
       // In the Scene component, update the handleWheel function
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  // Only allow zoom if not rotating
  if (!wasRotating.current) {
    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? 1 : -1;
    
    const isLandscape = viewport.width > viewport.height;
    
    // Get current bounds
    const minZoom = ZOOM_LEVELS.frontLayer[isLandscape ? 'landscape' : 'portrait'] - 1;
    const maxZoom = ZOOM_LEVELS.overview[isLandscape ? 'landscape' : 'portrait'] + 2;
    
    const newZoom = camera.position.z + delta * zoomSpeed;
    camera.position.z = Math.max(minZoom, Math.min(maxZoom, newZoom));
  }
};
        
        window.addEventListener('pointerdown', handlePointerDown)
        window.addEventListener('pointermove', handlePointerMove)
        window.addEventListener('pointerup', handlePointerUp)
        window.addEventListener('click', handleMediaClick)
        window.addEventListener('dblclick', handleDoubleClick)
        canvas.addEventListener('wheel', handleWheel, { passive: false })
        
        return () => {
          window.removeEventListener('pointerdown', handlePointerDown)
          window.removeEventListener('pointermove', handlePointerMove)
          window.removeEventListener('pointerup', handlePointerUp)
          window.removeEventListener('click', handleMediaClick)
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
    
          {/* Front layer - Images */}
          <ResponsiveImageStrip
            imagePaths={imagePaths}
            allowInteraction={allowInteraction.current}
            zPosition={0}
            mediaStates={mediaStates}
            onRotate={handleMediaRotation}
            wasRotating={wasRotatingState}
            isBackLayer={false}
          />
    
          {/* Back layer - Text */}
          <ResponsiveTextStrip
            textContents={backLayerTextContents}
            allowInteraction={allowInteraction.current}
            wasRotating={wasRotatingState}
            zPosition={-2}
            mediaStates={backLayerStates}
            isBackLayer={true}
            textColor="#ffffff"
            backgroundColor="rgba(0,0,0,0.7)"
            fontSize={24}
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