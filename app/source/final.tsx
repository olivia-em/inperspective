import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'

function AboutLink({ position = [0, -8, -3] }: { position?: [number, number, number] }) {
    const { viewport } = useThree()
    const isLandscape = viewport.width > viewport.height
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    const [hovered, setHovered] = useState(false)
    
    // Adjust position and size for mobile
    const mobilePosition = isLandscape ? [0, -5, -3] : [0, -9, -3]
    const finalPosition = isMobile ? mobilePosition : position
    const fontSize = isMobile ? (isLandscape ? 0.7 : 0.5) : (isLandscape ? 0.5 : 0.3)
    
    // Increase tap target size for mobile
    const tapScale = isMobile ? 1.5 : 1
  
    return (
      <Text
        position={finalPosition}
        rotation={[-3*Math.PI / 4, 0, 0]}
        fontSize={fontSize}
        color={hovered ? '#000000' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        scale={[tapScale, tapScale, tapScale]}
        onClick={(e) => {
          e.stopPropagation()
          window.location.href = '/about'
        }}
        onPointerOver={(e) => {
          document.body.style.cursor = 'pointer'
          setHovered(true)
          e.object.scale.set(1.1 * tapScale, 1.1 * tapScale, 1.1 * tapScale)
        }}
        onPointerOut={(e) => {
          document.body.style.cursor = 'auto'
          setHovered(false)
          e.object.scale.set(tapScale, tapScale, tapScale)
        }}
      >
        ABOUT
      </Text>
    )
  }

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
      landscape: 7,
      portrait: 6
    },
    // Focus on back layer
    backLayer: {
      landscape: 6,
      portrait: 2
    },
    // Focus on front layer
    frontLayer: {
      landscape: 4,
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

  const MediaFocusContext = React.createContext<{
    focusedItem: { index: number | null, layer: 'front' | 'back' | null },
    setFocusedItem: (item: { index: number | null, layer: 'front' | 'back' | null }) => void
  }>({
    focusedItem: { index: null, layer: null },
    setFocusedItem: () => {}
  });

 // Common handleMediaClick function for both layers
const handleMediaFocus = (
    index: number, 
    position: THREE.Vector3, 
    layer: 'front' | 'back' | null,
    focusContext: {
      focusedItem: { index: number | null, layer: 'front' | 'back' | null },
      setFocusedItem: (item: { index: number | null, layer: 'front' | 'back' | null }) => void
    },
    animationContext: {
      targetPosition: React.MutableRefObject<THREE.Vector3>,
      targetZoom: React.MutableRefObject<number>,
      animating: React.MutableRefObject<boolean>
    },
    viewport: { width: number, height: number }
  ) => {
    const isLandscape = viewport.width > viewport.height;
    const { focusedItem, setFocusedItem } = focusContext;
    const { targetPosition, targetZoom, animating } = animationContext;
    
    // If index is null, user clicked in empty space - reset to overview
    if (index === null) {
      // Reset to overview
      targetPosition.current.set(0, 0, 0);
      targetZoom.current = getZoomLevel({ 
        layer: 'overview', 
        isLandscape 
      });
      setFocusedItem({ index: null, layer: null });
      animating.current = true;
      return;
    }
    
    // If clicked on same object already in focus, toggle back to overview
    if (focusedItem.index === index && focusedItem.layer === layer) {
      // Reset to overview
      targetPosition.current.set(0, 0, 0);
      targetZoom.current = getZoomLevel({ 
        layer: 'overview', 
        isLandscape 
      });
      setFocusedItem({ index: null, layer: null });
    } else {
      // Focus on the clicked item directly without going back to center first
      targetPosition.current.copy(position);
      targetZoom.current = getZoomLevel({ 
        layer: layer === 'back' ? 'backLayer' : 'frontLayer', 
        isLandscape 
      });
      setFocusedItem({ index, layer });
    }
    animating.current = true;
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
    fontSize = 100,  // Increased from default
    color = '#000000', 
    bgColor = 'rgba(0,0,0,0)',
    maxWidth = 800,  // Increased from 500
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
// Update the ResponsiveImageStrip component to use the shared focus handler
  export function ResponsiveImageStrip({ 
    imagePaths, 
    maxSize = 4,
    verticalOffset = 0,
    allowInteraction = true,
    wasRotating = false,
    zPosition = 0,
    mediaStates,
    onRotate,
    isBackLayer,
    animationContext,
    focusContext,
    viewport,
    isMobile = false
  }) {
    const groupRef = useRef(null)
    const [images, setImages] = useState([])
    const { camera } = useThree()
    const interactionEnabled = useRef(true)
    const interactionTimer = useRef(null)
    
    // Load images and compute aspect ratios
    useEffect(() => {
      const loader = new THREE.TextureLoader()
      Promise.all(
        imagePaths.map(
          path =>
            new Promise((resolve) => {
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
    
    // Handle click outside to reset focus
    useEffect(() => {
      const handlePointerDown = (e) => {
        if (!interactionEnabled.current) return;
        
        if (focusContext.focusedItem.index !== null) {
          const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1, 
            -(e.clientY / window.innerHeight) * 2 + 1
          )
          
          const raycaster = new THREE.Raycaster()
          raycaster.setFromCamera(mouse, camera)
          
          const intersects = raycaster.intersectObjects(groupRef.current?.children || [])
          
          if (intersects.length === 0) {
            // Only reset if click is not on any object
            const isLandscape = viewport.width > viewport.height;
            handleMediaFocus(
              null, 
              new THREE.Vector3(0, 0, 0), 
              null,
              focusContext,
              animationContext,
              viewport
            );
          }
        }
      };
      
      window.addEventListener('pointerdown', handlePointerDown);
      return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [camera, viewport, animationContext, focusContext]);
  
    if (images.length === 0) return null
  
    const isLandscape = viewport.width > viewport.height
    // Adjust spacing for mobile
    const spacing = isMobile 
      ? (isLandscape ? 0.5 : 0.3)  // Tighter spacing on mobile
      : (isLandscape ? 0.7 : 0.4)  // Original spacing for desktop
    const total = images.length
  
    // Adjust available space for mobile
    const availableSpace = isMobile
      ? (isLandscape ? viewport.width * 0.95 : viewport.height * 0.7)
      : (isLandscape ? viewport.width * 0.9 : viewport.height * 0.7)
  
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
  
          let position;
  
        //   if (isBackLayer) {
        //     // Ellipse dimensions (adjust to wrap around the front layer)
        //     const ellipseWidth = availableSpace * (isMobile ? 3 : 2.5)
        //     const ellipseHeight = maxHeight * (isMobile ? 1 : 1)
            
        //     // Add rotation offset to shift starting position
        //     const rotationOffset = Math.PI * 0.5 // Shifts by 90 degrees
            
        //     const angle = (i / total) * Math.PI * 2 + rotationOffset
            
        //     // Optional: tilt the ellipse by applying a rotation matrix
        //     const tiltAngle = Math.PI * 0.0 // Adjust this value for more/less tilt
        //     // position = new THREE.Vector3(
        //     //   Math.cos(angle) * (ellipseWidth / 2),
        //     //   Math.sin(angle) * (ellipseHeight / 2),
        //     //   zPosition
        //     // ).applyAxisAngle(new THREE.Vector3(1, 0, 0), tiltAngle)
        //   } else {
            position = new THREE.Vector3(xPos, yPos, zPosition)
        //   }
  
          // Scale effect for the focused image
          const isFocused = focusContext.focusedItem.index === i && 
                           focusContext.focusedItem.layer === (isBackLayer ? 'back' : 'front');
                           
          const scale = isBackLayer ? 
            (isFocused ? 1.2 : 1.0) : // Slight scale increase for back layer
            (isFocused ? 1.1 : 1.0);   // Original scale for front layer
        
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
                const basePosition = e.object.userData.basePosition;
                // Use the shared media focus handler
                handleMediaFocus(
                  i, 
                  basePosition, 
                  isBackLayer ? 'back' : 'front',
                  focusContext,
                  animationContext,
                  viewport
                );
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
// Update the ResponsiveTextStrip component similarly
export function ResponsiveTextStrip({ 
    textContents, 
    verticalOffset = 0,
    wasRotating = false,
    zPosition = 0,
    mediaStates,
    onRotate,
    isBackLayer,
    textColor = '#ffffff',
    backgroundColor = 'rgba(0,0,0,0.7)',
    fontSize = 48,  // Increased default fontSize
    animationContext,
    focusContext,
    viewport,
    isMobile = false
  }) {
    const groupRef = useRef(null)
    const [texts, setTexts] = useState([])
    const { camera } = useThree()
    const interactionEnabled = useRef(true)
    const interactionTimer = useRef(null)
  
    // Create text textures
    useEffect(() => {
      // Adjust fontSize for mobile but ensure it's still relatively large
      const adjustedFontSize = isMobile ? Math.max(24, fontSize * 0.8) : fontSize;
      
      const textData = textContents.map(text => {
        const result = createTextTexture(text, adjustedFontSize, textColor, backgroundColor)
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
    }, [textContents, fontSize, textColor, backgroundColor, isMobile])
    
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
    
    // Handle click outside to reset focus
    useEffect(() => {
      const handlePointerDown = (e) => {
        if (!interactionEnabled.current) return;
        
        if (focusContext.focusedItem.index !== null) {
          const mouse = new THREE.Vector2(
            (e.clientX / window.innerWidth) * 2 - 1, 
            -(e.clientY / window.innerHeight) * 2 + 1
          )
          
          const raycaster = new THREE.Raycaster()
          raycaster.setFromCamera(mouse, camera)
          
          // Check if we clicked on any object in the scene
          // Get all objects in the scene that can be interacted with
          const objectsToTest = []
          
          // Add the objects from the current group
          if (groupRef.current) {
            objectsToTest.push(...groupRef.current.children)
          }
          
          // Try to find any other interactive meshes in the scene
          scene.traverse((object) => {
            if (object.isMesh && object.userData && 
               (object.userData.layer === 'front' || object.userData.layer === 'back')) {
              objectsToTest.push(object)
            }
          })
          
          const intersects = raycaster.intersectObjects(objectsToTest)
          
          if (intersects.length === 0) {
            // Only reset if click is not on any object
            const isLandscape = viewport.width > viewport.height;
            handleMediaFocus(
              null, 
              new THREE.Vector3(0, 0, 0), 
              null,
              focusContext,
              animationContext,
              viewport
            );
          }
          // No else needed - if clicked on another object, that object's onClick will handle the focus
        }
      };
      
      window.addEventListener('pointerdown', handlePointerDown);
      return () => window.removeEventListener('pointerdown', handlePointerDown);
    }, [camera, viewport, animationContext, focusContext]);
  
    if (texts.length === 0) return null
  
    const isLandscape = viewport.width > viewport.height
    // Adjust spacing for mobile
    const spacing = isMobile 
      ? (isLandscape ? 0.5 : 0.3)  // Tighter spacing on mobile
      : (isLandscape ? 0.7 : 0.4)  // Original spacing for desktop
    const total = texts.length
  
    // Adjust available space for mobile
    const availableSpace = isMobile
      ? (isLandscape ? viewport.width * 0.95 : viewport.height * 0.8)
      : (isLandscape ? viewport.width * 0.9 : viewport.height * 0.7)
  
    // Calculate fixed width for text panels - use a larger proportion of space
    const baseWidth = (availableSpace - (total - 1) * spacing) / total
  
    // For top alignment in landscape mode, find the tallest text panel
    // Use 1:1 aspect ratio instead of 2:1 to make the text panels larger
    const aspectRatio = 1.5; // Previous was 2.0 (width/height)
    const maxHeight = Math.max(...texts.map(text => baseWidth / aspectRatio)); 
  
    // Pre-compute all heights for portrait positioning
    const heights = texts.map(text => baseWidth / aspectRatio);
  
    return (
      <group ref={groupRef} position={[0, verticalOffset, zPosition]}>
        {texts.map((textData, i) => {
          // Get corresponding image rotation values if available
          const imageRotation = mediaStates[i]?.rotation || new THREE.Euler(0, 0, 0)
          
          // Map rotation values to text parameters
          const rotationX = Math.abs(Math.sin((imageRotation.x % (Math.PI * 2)) / 2))
          const rotationY = Math.abs(Math.sin((imageRotation.y % (Math.PI * 2)) / 2))
          
          // Map to letter spacing and line height
          const letterSpacing = THREE.MathUtils.lerp(-10, 15, rotationX)
          const lineHeight = THREE.MathUtils.lerp(0.1, 2, rotationY)
    
          // Create text texture with mapped parameters
          const textRender = createTextTexture(
            textData.text,
            fontSize, // Use original fontSize for better text visibility
            textColor,
            backgroundColor,
            500, // maxWidth
            letterSpacing,
            lineHeight
          )
          
          // Use fixed width and height for text panels with the new aspect ratio
          const width = baseWidth;
          const height = width / aspectRatio; // Using the new aspect ratio
  
          // Position calculation
          let xPos = 0;
          let yPos = 0;
          
        //   if (isLandscape) {
        //     // Horizontal layout - center horizontally
        //     xPos = (i - total / 2 + 0.5) * (width + spacing);
            
        //     // Top alignment - align all tops with the tallest panel
        //     yPos = (maxHeight - height) / 2;
        //   } else {
        //     // Vertical layout - center horizontally
        //     xPos = 0;
            
        //     // Calculate position based on the heights of all previous panels
        //     let offset = 0;
            
        //     // Calculate total height of all panels plus spacing
        //     const totalHeight = heights.reduce((sum, h) => sum + h, 0) + (total - 1) * spacing;
            
        //     // Position starting from top
        //     offset = totalHeight / 2; // Start from the top edge
            
        //     // Subtract heights of all previous panels and their spacing
        //     for (let j = 0; j < i; j++) {
        //       offset -= heights[j] + spacing;
        //     }
            
        //     // Adjust by half the current panel height to position correctly
        //     offset -= height / 2;
            
        //     yPos = offset;
        //   }
  
          let position;
  
          if (isBackLayer) {
            // Ellipse dimensions that switch based on orientation
            const ellipseWidth = isLandscape 
              ? availableSpace * (isMobile ? 3 : 2.25)  // Landscape mode
              : maxHeight * (isMobile ? 25 : 40)       // Portrait mode
            
            const ellipseHeight = isLandscape 
              ? maxHeight * (isMobile ? 10 : 10)      // Landscape mode
              : availableSpace * (isMobile ? 0.8 : 1.0)// Portrait mode
            
            // Rotation offset shifts by different amounts based on orientation
            const rotationOffset = isLandscape
              ? Math.PI * 0.5       // Landscape: 90 degrees
              : Math.PI * -0.4      // Portrait: -40 degrees
            
            const angle = (i / total) * Math.PI * 2 + rotationOffset
            
            // Apply additional rotation for portrait mode
            const portraitRotation = isLandscape 
              ? 0 
              : Math.PI * 0.5  // 90 degrees right rotation in portrait
            
              position = new THREE.Vector3(
                Math.cos(angle) * (ellipseWidth / 2) + (isLandscape ? 0 : -1), // Only offset in landscape
                Math.sin(angle) * (ellipseHeight / 2),
                zPosition
              ).applyAxisAngle(new THREE.Vector3(0, 0, 1), portraitRotation)
          } else {
            position = new THREE.Vector3(xPos, yPos, zPosition)
          }
  
          // Scale effect for the focused panel
          const isFocused = focusContext.focusedItem.index === i && 
                            focusContext.focusedItem.layer === (isBackLayer ? 'back' : 'front');
                            
          // Increase the scale for back layer text - much larger now
          const scale = isBackLayer ? 
            (isFocused ? 3.0 : 2.2) : // Much larger scale for back layer text (was 1.4/1.0)
            (isFocused ? 1.1 : 1.0);  // Original scale for front layer
        
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
                const basePosition = e.object.userData.basePosition;
                
                // Always focus on clicked object, regardless of current focus state
                handleMediaFocus(
                  i, 
                  basePosition, 
                  isBackLayer ? 'back' : 'front',
                  focusContext,
                  animationContext,
                  viewport
                );
                
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
    // Replace focusedIndex with more comprehensive state
    const [focusedItem, setFocusedItem] = useState<{ 
      index: number | null, 
      layer: 'front' | 'back' | null 
    }>({
      index: null,
      layer: null
    });
    
    const targetPosition = useRef(new THREE.Vector3(0, 0, 0))
    const targetZoom = useRef(5)
    const animating = useRef(false)
    const isDragging = useRef(false)
    const [wasRotatingState, setWasRotatingState] = useState(false)
    const wasRotating = useRef(false)
    const lastPosition = useRef({ x: 0, y: 0 })
    const dragStartTime = useRef(0)
    const dragDistance = useRef({ x: 0, y: 0 })
    const activePanel = useRef<THREE.Mesh | null>(null)
    const allowInteraction = useRef(true)
    const interactionResetTimer = useRef<NodeJS.Timeout | null>(null)
    
    // Detect mobile
    const [isMobile, setIsMobile] = useState(false)
    
    useEffect(() => {
      // Set mobile state on component mount
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768)
      
      // Update on resize
      const handleResize = () => {
        setIsMobile(window.innerWidth < 768)
      }
      
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }, [])
  
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
      "I hadn't known it was a tug of war, until I woke up on his playing field finding nothing I could grasp. When I looked back at myself, all I saw was rope.",
      "Before you, the only false prophet I'd met was at the head of a childhood dinner table. I feel knee-high again and totally agnostic.",
      "I'd never felt so degraded as when I begged to follow someone lost. And then you crueler: to not admit where you stood on me, but expect I shed your weight alone.",
      "The night I attended the death of respect among bean bags on the floor, I spiraled home alone. My depth had only gone so far as my body, but icon or object… I hadn't known. Like with him, there won't be hauntings, but I'll gladly be a ghost.",
      "I used to have a friend who double-crossed me out of spite; the resemblance is uncanny, like how you stare when someone cries."
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
  
    // Animation frame handler
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
        }, 300);
      }
      
      return () => {
        if (interactionResetTimer.current) {
          clearTimeout(interactionResetTimer.current);
        }
      };
    }, [wasRotatingState]);
  
    // Handle media rotation
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
    
    // Setup pointer/touch event handlers
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
          // Use a different threshold for mobile to make rotation easier
          const threshold = isMobile ? 2 : 5
          if (dragDistance.current.x > threshold || dragDistance.current.y > threshold) {
            scene.rotation.y += deltaX
            scene.rotation.x += deltaY
            wasRotating.current = true
            setWasRotatingState(true)
            allowInteraction.current = false
          }
        }
      }
          
      const handlePointerUp = (e: PointerEvent) => {
        const dragDuration = Date.now() - dragStartTime.current
        const dragTotalDistance = dragDistance.current.x + dragDistance.current.y
        
        // Consider it a click only if drag was short in time and distance
        // Use a larger threshold for mobile devices
        const clickThreshold = isMobile ? 15 : 10
        const isClick = dragDuration < 200 && dragTotalDistance < clickThreshold
        
        if (!isClick && wasRotating.current) {
          wasRotating.current = true
          setWasRotatingState(true)
        } else if (isClick) {
          // This was a clean click, always enable interaction for clicks
          wasRotating.current = false;
          setWasRotatingState(false);
          allowInteraction.current = true;
        }
        
        isDragging.current = false
        activePanel.current = null
      }
      
      // Force enable interaction when user does a click with no drag
      const handleMediaClick = (e: MouseEvent) => {
        if (!wasRotating.current && dragDistance.current.x < 5 && dragDistance.current.y < 5) {
          wasRotating.current = false;
          setWasRotatingState(false);
          allowInteraction.current = true;
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
        setFocusedItem({ index: null, layer: null });
      };
          
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        // Only allow zoom if not rotating
        if (!wasRotating.current) {
          const zoomSpeed = 0.1;
          const delta = e.deltaY > 0 ? 1 : -1;
          
          const isLandscape = viewport.width > viewport.height;
          
          // Get current bounds
          const minZoom = ZOOM_LEVELS.frontLayer[isLandscape ? 'landscape' : 'portrait'] - 0.5;
          const maxZoom = ZOOM_LEVELS.overview[isLandscape ? 'landscape' : 'portrait'] + 1;
          
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
    }, [scene, camera, gl, isMobile]) // Add isMobile to dependencies
        
    // Create animation context for shared use in components
    const animationContext = {
      targetPosition,
      targetZoom,
      animating
    };
    
    // Create focus context
    const focusContext = {
      focusedItem,
      setFocusedItem
    };
        
    return (
      <MediaFocusContext.Provider value={focusContext}>
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
          animationContext={animationContext}
          focusContext={focusContext}
          viewport={viewport}
          isMobile={isMobile}
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
          fontSize={isMobile ? 18 : 24}
          animationContext={animationContext}
          focusContext={focusContext}
          viewport={viewport}
          isMobile={isMobile}
        />
  
        <AboutLink />
  
        <ambientLight intensity={4} />
        <pointLight position={[0, 0, 5]} />
      </MediaFocusContext.Provider>
    )
  }
    
    
    export default function Cubez() {
      return (
        <Canvas camera={{ position: [0, 0, 5] }}>
          <Scene />
        </Canvas>
      )
    }