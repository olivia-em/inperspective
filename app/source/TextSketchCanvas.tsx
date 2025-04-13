import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

interface TextSketchCanvasProps {
  rotationX: number;
  rotationY: number;
  onTextureReady: (texture: THREE.Texture, index: number) => void;
  index: number;
  width?: number;
  height?: number;
}

const TextSketchCanvas: React.FC<TextSketchCanvasProps> = ({
  rotationX,
  rotationY,
  onTextureReady,
  index,
  width = 800,
  height = 600
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [p5, setP5] = useState<any>(null);

  useEffect(() => {
    // Dynamically import p5 only on the client side
    import('p5').then((p5Module) => {
      setP5(p5Module.default);
    });
  }, []);

  useEffect(() => {
    if (!p5) return; // Don't proceed until p5 is loaded

    let p: any;

    const sketch = (s: any) => {
      // ...rest of your sketch code...
    };

    p = new p5(sketch, containerRef.current!);
    return () => p.remove();
  }, [p5, rotationX, rotationY]);

  return <div ref={containerRef} style={{ display: 'none' }} />;
};

export default TextSketchCanvas;

// // components/TextSketchCanvas.tsx
// import React, { useRef, useEffect } from 'react';
// import P5 from 'p5';
// type p5 = P5;
// import * as THREE from 'three';

// interface TextSketchCanvasProps {
//   rotationX: number;
//   rotationY: number;
//   onTextureReady: (texture: THREE.Texture, index: number) => void;
//   index: number;
//   width?: number;
//   height?: number;
// }

// const TextSketchCanvas: React.FC<TextSketchCanvasProps> = ({
//   rotationX,
//   rotationY,
//   onTextureReady,
//   index,
//   width = 800,
//   height = 600
// }) => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);

//   useEffect(() => {
//     let p: p5;

//     const sketch = (s: p5) => {
//       const fontSize = 20;
//       const boxWidth = 500;
//       const boxHeight = 300;
//       const boxX = 150;
//       const boxY = 150;

//       const lineBreaks = [
//         "I hadn't known it was a tug of war,", 
//         "until I woke up on his playing field", 
//         "finding nothing I could grasp.",
//         "When I looked back at myself,", 
//         "all I saw was rope."
//       ];

//       let myFont: p5.Font;

//       s.preload = () => {
//         myFont = s.loadFont('https://cdnjs.cloudflare.com/ajax/libs/topcoat/0.8.0/font/SourceSansPro-Regular.otf');
//       };

//       s.setup = () => {
//         const c = s.createCanvas(width, height);
//         c.hide();
//         canvasRef.current = c.elt as HTMLCanvasElement;
//         s.textFont(myFont);
//         s.textSize(fontSize);
//         s.textAlign(s.LEFT, s.TOP);
//         s.noLoop();
//       };

//       s.draw = () => {
//         s.background(240);
//         s.noFill();
//         s.stroke(180);
//         s.rect(boxX, boxY, boxWidth, boxHeight);

//         const letterSpacing = s.map(rotationX, 0, 1, -2.5, 15);
//         const lineHeight = s.map(rotationY, 0, 1, fontSize * 0.1, fontSize * 2);
//         const horizontalCompression = s.map(rotationX, 0, 1, 0.1, 1.0);

//         let totalTextHeight = lineBreaks.length * lineHeight;
//         let y = boxY + (boxHeight - totalTextHeight) / 2;

//         s.fill(20);
//         s.noStroke();

//         for (let i = 0; i < lineBreaks.length; i++) {
//           let line = lineBreaks[i];
//           let lineWidth = 0;
//           for (let j = 0; j < line.length; j++) {
//             lineWidth += s.textWidth(line[j]) + letterSpacing;
//           }

//           let x = boxX + (boxWidth - lineWidth * horizontalCompression) / 2;

//           for (let j = 0; j < line.length; j++) {
//             let char = line[j];
//             s.text(char, x, y);
//             x += (s.textWidth(char) + letterSpacing) * horizontalCompression;
//           }

//           y += lineHeight;
//         }

//         if (canvasRef.current) {
//           const tex = new THREE.CanvasTexture(canvasRef.current);
//           tex.needsUpdate = true;
//           onTextureReady(tex, index);
//         }
//       };
//     };

//     p = new p5(sketch, containerRef.current!);
//     return () => p.remove();
//   }, [rotationX, rotationY]);

//   return <div ref={containerRef} style={{ display: 'none' }} />;
// };

// export default TextSketchCanvas;
