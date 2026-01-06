"use client"

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface DiceProps {
  value: number
  rolling: boolean
  delay?: number
}

// Dot positions for each face (1-6)
const dotPatterns: Record<number, { row: number; col: number }[]> = {
  1: [{ row: 2, col: 2 }],
  2: [{ row: 1, col: 1 }, { row: 3, col: 3 }],
  3: [{ row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }],
  4: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }],
  5: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 2 }, { row: 3, col: 1 }, { row: 3, col: 3 }],
  6: [{ row: 1, col: 1 }, { row: 1, col: 3 }, { row: 2, col: 1 }, { row: 2, col: 3 }, { row: 3, col: 1 }, { row: 3, col: 3 }],
}

// 3D Cube Face
const CubeFace: React.FC<{ faceValue: number; transform: string; shade?: number }> = ({ 
  faceValue, transform, shade = 0 
}) => {
  const dots = dotPatterns[faceValue] || []
  // White with slight shade variation for 3D depth
  const brightness = 255 - shade * 15
  const bgColor = `rgb(${brightness}, ${brightness}, ${brightness})`
  // Face 1 has red dot, others have black
  const dotColor = faceValue === 1 ? '#DC2626' : '#1e293b'
  
  return (
    <div 
      className="absolute w-full h-full rounded-lg flex items-center justify-center"
      style={{ 
        backgroundColor: bgColor,
        backfaceVisibility: 'hidden',
        transform,
        border: '1px solid rgba(0,0,0,0.1)',
        boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
      }}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-1 w-12 h-12">
        {[1, 2, 3].map(row => 
          [1, 2, 3].map(col => {
            const hasDot = dots.some(d => d.row === row && d.col === col)
            return (
              <div key={`${row}-${col}`} className="flex items-center justify-center">
                {hasDot && (
                  <div 
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ 
                      backgroundColor: dotColor,
                      boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.3)'
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// 2D Flat Face (for result display)
const FlatFace: React.FC<{ faceValue: number }> = ({ faceValue }) => {
  const dots = dotPatterns[faceValue] || []
  // Face 1 has red dot, others have black
  const dotColor = faceValue === 1 ? '#DC2626' : '#1e293b'
  
  return (
    <div 
      className="w-20 h-20 rounded-xl flex items-center justify-center bg-white"
      style={{ 
        boxShadow: '0 4px 0 #d1d5db, 0 6px 20px rgba(0,0,0,0.15)',
      }}
    >
      <div className="grid grid-cols-3 grid-rows-3 gap-2 w-14 h-14">
        {[1, 2, 3].map(row => 
          [1, 2, 3].map(col => {
            const hasDot = dots.some(d => d.row === row && d.col === col)
            return (
              <div key={`${row}-${col}`} className="flex items-center justify-center">
                {hasDot && (
                  <div 
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ 
                      backgroundColor: dotColor,
                      boxShadow: 'inset 0 -1px 3px rgba(0,0,0,0.3)'
                    }}
                  />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// 3D Cube Component
const Cube3D: React.FC<{ delay: number }> = ({ delay }) => {
  return (
    <div 
      className="relative w-16 h-16"
      style={{ perspective: '300px' }}
    >
      <motion.div
        className="relative w-full h-full"
        style={{ 
          transformStyle: 'preserve-3d',
          transform: 'rotateX(-20deg) rotateY(30deg)',
        }}
        animate={{
          rotateX: [0, 360, 720, 1080],
          rotateY: [0, -360, -720, -1080],
        }}
        transition={{
          duration: 1.2,
          delay,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {/* Front - 1 (red dot) */}
        <CubeFace faceValue={1} transform="translateZ(32px)" shade={0} />
        {/* Back - 6 */}
        <CubeFace faceValue={6} transform="rotateY(180deg) translateZ(32px)" shade={2} />
        {/* Right - 3 */}
        <CubeFace faceValue={3} transform="rotateY(90deg) translateZ(32px)" shade={1} />
        {/* Left - 4 */}
        <CubeFace faceValue={4} transform="rotateY(-90deg) translateZ(32px)" shade={1} />
        {/* Top - 2 */}
        <CubeFace faceValue={2} transform="rotateX(90deg) translateZ(32px)" shade={0} />
        {/* Bottom - 5 */}
        <CubeFace faceValue={5} transform="rotateX(-90deg) translateZ(32px)" shade={2} />
      </motion.div>
    </div>
  )
}

export const Dice: React.FC<DiceProps> = ({ value, rolling, delay = 0 }) => {
  const [showCube, setShowCube] = useState(rolling)

  useEffect(() => {
    if (rolling) {
      setShowCube(true)
    } else {
      // When rolling stops, transition from 3D to 2D
      const timer = setTimeout(() => setShowCube(false), 100)
      return () => clearTimeout(timer)
    }
  }, [rolling])

  return (
    <div className="relative flex items-center justify-center w-20 h-20">
      <AnimatePresence mode="wait">
        {showCube ? (
          <motion.div
            key="cube"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, rotateX: 90 }}
            transition={{ duration: 0.3 }}
          >
            <Cube3D delay={delay} />
          </motion.div>
        ) : (
          <motion.div
            key="flat"
            initial={{ opacity: 0, scale: 0.8, rotateX: -90 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ duration: 0.3, delay: delay * 0.5 }}
          >
            <FlatFace faceValue={value} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
