import {type ReactNode} from "react";
import {motion, useReducedMotion} from "motion/react";

// Workspace view swap. Honors prefers-reduced-motion: when the user opts out
// we keep the cross-fade instant (no slide/scale) so the page just swaps —
// the AnimatePresence parent still gets a clean unmount/mount cycle.
export function AnimatedWorkspaceView({children, direction}: {children: ReactNode; direction: 1 | -1}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="h-svh min-w-0 overflow-hidden"
      initial={reduced ? {opacity: 1} : {opacity: 0, x: direction * 18, scale: 0.995}}
      animate={{opacity: 1, x: 0, scale: 1}}
      exit={reduced ? {opacity: 1} : {opacity: 0, x: direction * -14, scale: 0.998}}
      transition={reduced ? {duration: 0} : {duration: 0.18, ease: [0.22, 1, 0.36, 1]}}
    >
      {children}
    </motion.div>
  );
}
