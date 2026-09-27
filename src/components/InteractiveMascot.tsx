"use client";

import React, { useState, useEffect } from 'react';

export default function InteractiveMascot() {
  const [frame, setFrame] = useState(1);
  const [position, setPosition] = useState<'left' | 'center' | 'right'>('right');

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const handleMouseEnter = () => {
    setPosition((prev) => {
      const others = (['left', 'center', 'right'] as const).filter((p) => p !== prev);
      return others[Math.floor(Math.random() * others.length)];
    });
  };

  const imageSrc = `/images/mascot/sequences/greet/frame-0${frame}.png`;

  return (
    <div
      onMouseEnter={handleMouseEnter}
      className={`fixed bottom-4 z-[100] transition-all duration-500 ease-in-out ${
        position === 'left' ? 'left-8' : position === 'right' ? 'right-8' : 'left-1/2 -translate-x-1/2'
      }`}
    >
      <img
        src={imageSrc}
        alt="Interactive Mascot"
        className="w-40 h-auto drop-shadow-lg cursor-pointer"
      />
    </div>
  );
}
