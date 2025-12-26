import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './AmbientBackground.css';

/**
 * Aurora Ambient Background - Premium animated mesh gradient
 * 
 * Features:
 * - 3-layer radial gradient system with GPU-optimized animations
 * - Double-buffer crossfade for smooth color transitions between songs
 * - Zero client-side processing (uses backend pre-extracted colors)
 * - Performance: GPU-only (transform + opacity), no backdrop-filter
 * 
 * @param {string} songId - Unique song ID for AnimatePresence key
 * @param {object} colors - Pre-extracted colors { dominant, lightVibrant, darkMuted }
 * @param {number} intensity - Opacity multiplier (0-1), default 0.6
 */
export default function AmbientBackground({ songId, colors, intensity = 0.6 }) {

    // Fallback to vibrant test colors if no colors provided (for debugging)
    const safeColors = colors || {
        dominant: '#ff0066',     // Vibrant pink for testing
        lightVibrant: '#00ffff', // Vibrant cyan for testing
        darkMuted: '#9900ff'     // Vibrant purple for testing
    };

    // If colors exist but are all black/dark, use test colors
    const isDark = safeColors.dominant === '#000000' ||
        safeColors.dominant === '#121212' ||
        !safeColors.dominant;

    const finalColors = isDark ? {
        dominant: '#ff0066',
        lightVibrant: '#00ffff',
        darkMuted: '#9900ff'
    } : safeColors;


    // CSS custom properties for gradient colors
    const style = {
        '--primary-color': finalColors.dominant,
        '--secondary-color': finalColors.lightVibrant,
        '--accent-color': finalColors.darkMuted,
        '--intensity': intensity
    };

    return (
        <div className="ambient-background-wrapper">
            <AnimatePresence mode="sync">
                <motion.div
                    key={songId || 'default'}
                    className="ambient-aurora"
                    style={style}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{
                        duration: 1.5,
                        ease: 'easeInOut'
                    }}
                >
                    {/* Layer 1: Primary color (top-left) - Slow breathing */}
                    <motion.div
                        className="aurora-orb aurora-primary"
                        animate={{
                            x: [0, 30, -15, 0],
                            y: [0, -20, 10, 0],
                            scale: [1, 1.1, 0.95, 1]
                        }}
                        transition={{
                            duration: 20, // Slower, more luxurious
                            repeat: Infinity,
                            ease: 'easeInOut'
                        }}
                    />

                    {/* Layer 2: Secondary color (bottom-right) - Wave motion */}
                    <motion.div
                        className="aurora-orb aurora-secondary"
                        animate={{
                            x: [0, -25, 20, 0],
                            y: [0, 35, -10, 0],
                            scale: [1, 1.15, 1.05, 1]
                        }}
                        transition={{
                            duration: 22,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 0.3
                        }}
                    />

                    {/* Layer 3: Accent color (center) - Pulse effect */}
                    <motion.div
                        className="aurora-orb aurora-accent"
                        animate={{
                            x: [0, 15, -10, 0],
                            y: [0, -15, 20, 0],
                            scale: [1, 1.08, 1.02, 1]
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: 0.6
                        }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* Scrim Layer: Ensures typography contrast */}
            <div className="ambient-scrim" />
        </div>
    );
}
