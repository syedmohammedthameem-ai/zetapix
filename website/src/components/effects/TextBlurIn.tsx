import type { ClassValue } from 'clsx';
import { motion, useInView } from 'framer-motion';
import * as React from 'react';
import { cn } from '../../utils/tailwind';
 
export const TextBlurIn = ({ children, className }: { children: React.ReactNode, className: ClassValue }) => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true });
  return (
    <motion.h5
      ref={ref}
      initial={{ filter: 'blur(20px)', opacity: 0 }}
      animate={isInView ? { filter: 'blur(0px)', opacity: 1 } : {}}
      transition={{ duration: 1.2 }}
      className={cn("text-xl text-center sm:text-4xl font-bold tracking-tighter md:text-6xl md:leading-16", className)}
    >
      {children}
    </motion.h5>
  );
};