import React, { useEffect, useState } from 'react';
import TextSketchCanvas from './TextSketchCanvas';

interface ClientOnlyTextSketchProps {
  rotationX: number;
  rotationY: number;
  onTextureReady: (texture: any, index: number) => void;
  index: number;
  width?: number;
  height?: number;
}

const ClientOnlyTextSketch: React.FC<ClientOnlyTextSketchProps> = (props) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <TextSketchCanvas {...props} />;
};

export default ClientOnlyTextSketch;