import React, { useRef, useState, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import ResponsiveImageStrip from './Cubez'
import TextSketchCanvas from './TextSketchCanvas'

interface ImageState {
  rotation: THREE.Euler
  position: THREE.Vector3
  isActive: boolean
}

function Scene() {
  const { scene, camera, gl } = useThree()
  const isDragging = useRef(false)
  const wasRotating = useRef(false)
  const [wasRotatingState, setWasRotatingState] = useState(false)
  const [backTextures, setBackTextures] = useState<(THREE.Texture | null)[]>(
    Array(5).fill(null)
  )
  const [imageStates, setImageStates] = useState<ImageState[]>(
    Array(5)
      .fill(null)
      .map(() => ({
        rotation: new THREE.Euler(0, 0, 0),
        position: new THREE.Vector3(0, 0, 0),
        isActive: false,
      }))
  )

  const imagePaths = [
    '/assets/first.png',
    '/assets/next.png',
    '/assets/then.png',
    '/assets/and.png',
    '/assets/fin.png',
  ]

  const pentagonOrder = [2, 0, 1, 3, 4]
  const backLayerStates = pentagonOrder.map((i) => imageStates[i])

  const handleImageRotation = (
    index: number,
    deltaX: number,
    deltaY: number,
    basePosition: THREE.Vector3
  ) => {
    setImageStates((prev) =>
      prev.map((state, i) => {
        if (i === index) {
          const newRotation = new THREE.Euler(
            state.rotation.x + deltaY,
            state.rotation.y + deltaX,
            0
          )
          return {
            ...state,
            rotation: newRotation,
            position: new THREE.Vector3(
              basePosition.x + Math.sin(newRotation.y) * 3,
              basePosition.y + Math.sin(newRotation.x) * 3,
              -1
            ),
          }
        }
        return state
      })
    )
  }

  const handleTextureReady = (texture: THREE.Texture, index: number) => {
    setBackTextures((prev) => {
      const updated = [...prev]
      updated[index] = texture
      return updated
    })
  }

  const allTexturesReady = backTextures.every((t) => t !== null)

  return (
    <>
      {pentagonOrder.map((i, idx) => (
        <TextSketchCanvas
          key={i}
          index={idx}
          rotationX={Math.abs(Math.sin(imageStates[i].rotation.x))}
          rotationY={Math.abs(Math.sin(imageStates[i].rotation.y))}
          onTextureReady={handleTextureReady}
        />
      ))}

      {allTexturesReady && (
        <ResponsiveImageStrip
          imagePaths={imagePaths}
          allowInteraction={true}
          zPosition={0}
          imageStates={imageStates}
          onRotate={(i, dx, dy) =>
            handleImageRotation(i, dx, dy, imageStates[i].position)
          }
          wasRotating={wasRotatingState}
          isBackLayer={false}
        />
      )}

      {allTexturesReady && (
        <group position={[0, 0, -2]}>
          {pentagonOrder.map((originalIndex, i) => {
            const texture = backTextures[i]
            const state = imageStates[originalIndex]
            return (
              <mesh
                key={i}
                position={state.position}
                rotation={new THREE.Euler(0, 0, 0)}
                scale={[4, 4, 4]}
              >
                <planeGeometry args={[4, 3]} />
                <meshBasicMaterial
                  map={texture!}
                  transparent
                  side={THREE.DoubleSide}
                />
              </mesh>
            )
          })}
        </group>
      )}

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
