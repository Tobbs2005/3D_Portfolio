import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingTextProps {
  texts: string[];
  onComplete?: () => void;
}

const TypingText = ({ texts, onComplete }: TypingTextProps) => {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current) return;

    // Display time for each text
    const displayTime = 2000;

    const timeout = window.setTimeout(() => {
      // If this is the last text, complete
      if (currentTextIndex === texts.length - 1) {
        completedRef.current = true;
        onComplete?.();
        return;
      }

      // Fade out, then move to next text
      setIsVisible(false);

      window.setTimeout(() => {
        setCurrentTextIndex((prev) => prev + 1);
        setIsVisible(true);
      }, 300);
    }, displayTime);

    return () => window.clearTimeout(timeout);
  }, [currentTextIndex, texts, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center pointer-events-none select-none"
    >
      <h1 className="text-4xl md:text-6xl font-heading font-semibold text-foreground">
        <AnimatePresence mode="wait">
          {isVisible && (
            <motion.span
              key={currentTextIndex}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                transition: {
                  opacity: { duration: 0.3 },
                  scale: { 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 15,
                    mass: 0.8
                  }
                }
              }}
              exit={{ 
                opacity: 0, 
                scale: 0.9,
                transition: { duration: 0.2 }
              }}
              className="inline-block"
            >
              {texts[currentTextIndex]}
            </motion.span>
          )}
        </AnimatePresence>
      </h1>
    </motion.div>
  );
};

export default TypingText;
