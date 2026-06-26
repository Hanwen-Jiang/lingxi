import {type ReactNode} from "react";
import {motion} from "motion/react";

export function AnimatedWorkspaceView({children, direction}: {children: ReactNode; direction: 1 | -1}) {
  return (
    <motion.div
      className="h-svh min-w-0 overflow-hidden"
      initial={{opacity: 0, x: direction * 18, scale: 0.995}}
      animate={{opacity: 1, x: 0, scale: 1}}
      exit={{opacity: 0, x: direction * -14, scale: 0.998}}
      transition={{duration: 0.18, ease: [0.22, 1, 0.36, 1]}}
    >
      {children}
    </motion.div>
  );
}
