'use client';

import { useEffect } from 'react';

export default function ZoomPreventer() {
  useEffect(() => {
    const preventPinch = (e: TouchEvent) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    // Safari uses gesture events; Chrome/Firefox use multi-touch touchmove
    const preventGesture = (e: Event) => e.preventDefault();

    document.addEventListener('touchmove', preventPinch, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false } as AddEventListenerOptions);
    document.addEventListener('gesturechange', preventGesture, { passive: false } as AddEventListenerOptions);

    return () => {
      document.removeEventListener('touchmove', preventPinch);
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
    };
  }, []);

  return null;
}
