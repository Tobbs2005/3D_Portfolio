import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SmileyBall from "./SmileyBall";
import TypingText from "./TypingText";
import { ChevronDown } from "lucide-react";
import { preloadResumeProjectImages } from "@/lib/preloadImages";

interface IntroScreenProps {
  onEnter: () => void;
}

const IntroScreen = ({ onEnter }: IntroScreenProps) => {
  const [typingComplete, setTypingComplete] = useState(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const enteredRef = useRef(false);

  // Preload images ASAP (and keep the intro screen until they're decoded).
  useEffect(() => {
    preloadResumeProjectImages().finally(() => setAssetsReady(true));
  }, []);

  useEffect(() => {
    if (!typingComplete || !assetsReady) return;

    const enterOnce = () => {
      if (enteredRef.current) return;
      enteredRef.current = true;
      onEnter();
    };

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 0) enterOnce();
    };

    const handleTouchStart = () => enterOnce();
    const handlePointerDown = () => enterOnce();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", "Space", "Enter"].includes(e.code)) enterOnce();
    };

    window.addEventListener("wheel", handleWheel, { passive: true, capture: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true, capture: true });
    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("wheel", handleWheel, true);
      window.removeEventListener("touchstart", handleTouchStart, true);
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [typingComplete, assetsReady, onEnter]);

  const introTexts = ["Hi, I'm Ziyue.", "I build things.", "Welcome to my portfolio."];

  return (
    <motion.div
      className="fixed inset-0 z-50 overflow-hidden"
      exit={{ opacity: 0, y: -50 }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* 3D Background - full screen */}
      <div className="absolute inset-0">
        <SmileyBall />
      </div>

      {/* Text overlay - centered on top of 3D */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div className="px-4">
          <TypingText texts={introTexts} onComplete={() => setTypingComplete(true)} />
        </div>
      </div>

      {/* Scroll prompt - positioned at bottom, doesn't affect layout */}
      <AnimatePresence>
        {typingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="absolute bottom-12 left-0 right-0 flex flex-col items-center gap-2 text-muted-foreground pointer-events-none z-10"
          >
            {!assetsReady ? (
              <span className="text-sm font-body tracking-wider uppercase">
                Loading images...
              </span>
            ) : (
              <>
                <span className="text-sm font-body tracking-wider uppercase">
                  Scroll to explore
                </span>
                <motion.div
                  animate={{ y: [0, 8, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ChevronDown className="w-6 h-6" />
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default IntroScreen;

