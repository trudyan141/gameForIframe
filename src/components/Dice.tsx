"use client"

import React from 'react'
import { motion } from 'framer-motion'

interface DiceProps {
  value: number
  rolling: boolean
  delay?: number
}

// Dot positions for each face (1-6)
const dotPositions: Record<number, { top: string; left: string }[]> = {
  1: [{ top: '50%', left: '50%' }],
  2: [{ top: '25%', left: '25%' }, { top: '75%', left: '75%' }],
  3: [{ top: '25%', left: '25%' }, { top: '50%', left: '50%' }, { top: '75%', left: '75%' }],
  4: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
  5: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '50%', left: '50%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
  6: [{ top: '25%', left: '25%' }, { top: '25%', left: '75%' }, { top: '50%', left: '25%' }, { top: '50%', left: '75%' }, { top: '75%', left: '25%' }, { top: '75%', left: '75%' }],
}

export const Dice: React.FC<DiceProps> = ({ value, rolling, delay = 0 }) => {
  const dots = dotPositions[value] || dotPositions[1]

  return (
    <motion.div
      animate={rolling ? {
        rotateX: [0, 360, 720, 1080],
        rotateY: [0, 180, 360, 540],
        scale: [1, 1.1, 0.9, 1],
      } : {
        rotateX: 0,
        rotateY: 0,
        scale: 1,
      }}
      transition={{
        duration: 1.2,
        delay: delay,
        ease: "easeOut",
      }}
      className="relative w-16 h-16 bg-white rounded-xl shadow-[0_8px_20px_rgba(0,0,0,0.3),inset_0_-4px_0_rgba(0,0,0,0.1)] border-2 border-slate-100"
      style={{ transformStyle: 'preserve-3d' }}
    >
      {dots.map((pos, i) => (
        <div
          key={i}
          className="absolute w-3 h-3 bg-slate-800 rounded-full -translate-x-1/2 -translate-y-1/2"
          style={{ top: pos.top, left: pos.left }}
        />
      ))}
    </motion.div>
  )
}
