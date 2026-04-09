import { useLayoutEffect, useRef, useState, useEffect } from 'react';

/**
 * A lightweight reveal hook that replaces GSAP.
 * Sets the container to visible after a brief delay, allowing CSS transitions to handle the animation.
 * Falls back gracefully if GSAP is not installed.
 */
export const useGSAPListReveal = (dependencies: any[]) => {
  const container = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Small delay to allow the DOM to paint, then reveal
    const timer = requestAnimationFrame(() => {
      if (container.current) {
        container.current.style.opacity = '1';
        container.current.style.transform = 'translateY(0)';
      }
      setRevealed(true);
    });

    return () => cancelAnimationFrame(timer);
  }, dependencies);

  return container;
};
