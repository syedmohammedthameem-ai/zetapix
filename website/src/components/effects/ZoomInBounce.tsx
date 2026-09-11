import React from 'react'
import { motion, useInView, type Variants } from 'framer-motion';

const animationVariant: Variants = {
    initial: {
        scale: 0,
        zIndex: 0,
        opacity: 0,
    },
    animate: {
        scale: 1,
        opacity: 1,
        zIndex: 0,
        transition: {
            type: "spring",
            stiffness: 260,
            damping: 20,
            duration: 5,
            ease: [0.9, 0.1, 0.25, 1],
        },
    },
    front: {
        scale: 1.1,
        zIndex: 10,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 260,
            damping: 20,
        },
    },
};

export function ZoomInBounce({ children }: { children: React.ReactNode }) {
    const ref = React.useRef(null);
    const isInView = useInView(ref, { once: true });

    return (
        <motion.div
            ref={ref}
            variants={animationVariant}
            initial="initial"
            animate={isInView ? 'animate' : 'initial'}

        >{children}</motion.div>
    )
}

