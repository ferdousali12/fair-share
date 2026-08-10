import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [show, setShow] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => {
        setShow(false);
        onComplete();
      }, 500);
    }, 2000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background transition-opacity duration-500 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="text-center animate-leaf-fade">
        {/* Leaf SVG draw-in */}
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto mb-6"
        >
          <path
            d="M40 8C40 8 20 20 16 36C12 52 24 64 40 68C56 64 68 52 64 36C60 20 40 8 40 8Z"
            stroke="#1B7A4D"
            strokeWidth="3"
            fill="none"
            className="animate-leaf-draw"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M40 68V36"
            stroke="#1B7A4D"
            strokeWidth="2.5"
            className="animate-leaf-draw"
            style={{ animationDelay: '0.6s' }}
            strokeLinecap="round"
          />
          <path
            d="M40 36L28 24"
            stroke="#2FAE6B"
            strokeWidth="2"
            className="animate-leaf-draw"
            style={{ animationDelay: '0.9s' }}
            strokeLinecap="round"
          />
          <path
            d="M40 36L52 24"
            stroke="#2FAE6B"
            strokeWidth="2"
            className="animate-leaf-draw"
            style={{ animationDelay: '1.1s' }}
            strokeLinecap="round"
          />
        </svg>

        <h1 className="font-heading text-3xl font-bold text-green-900 tracking-tight">
          Fair Share
        </h1>
        <p className="text-foreground mt-2 text-sm">Split expenses. Stay fair.</p>
      </div>
    </div>
  );
}