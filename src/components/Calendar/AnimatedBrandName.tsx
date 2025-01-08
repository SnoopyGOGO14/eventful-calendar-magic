import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Text } from '@react-three/drei';

interface AnimatedBrandNameProps {
  name: string;
}

export const AnimatedBrandName: React.FC<AnimatedBrandNameProps> = ({ name }) => {
  const textRef = useRef<any>();

  return (
    <div className="h-12 w-full">
      <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Text
          ref={textRef}
          color="white"
          fontSize={0.5}
          maxWidth={200}
          lineHeight={1}
          letterSpacing={0.02}
          textAlign="center"
          font="https://fonts.gstatic.com/s/raleway/v14/1Ptrg8zYS_SKggPNwK4vaqI.woff"
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0]}
        >
          {name}
          <meshStandardMaterial attach="material" color="white" />
        </Text>
      </Canvas>
    </div>
  );
};