"use client"

import React from 'react'
import { motion } from 'framer-motion'
import { Play, Sparkles } from 'lucide-react'

interface PlayScreenProps {
  onPlay: () => void
  loading: boolean
  isWaiting?: boolean
}

export const PlayScreen: React.FC<PlayScreenProps> = ({ onPlay, loading, isWaiting }) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Logo & Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-12"
      >
        <div className="absolute -inset-8 bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-violet-500/20 blur-3xl rounded-full opacity-60" />
        
        <div className="relative flex gap-3 mb-6 justify-center">
          {['🎲', '🎲', '🎲'].map((_, i) => (
            <motion.span 
              key={i}
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ delay: i * 0.1, duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              className="text-5xl"
            >
              🎲
            </motion.span>
          ))}
        </div>
        
        <h1 className="relative text-4xl font-black tracking-tight">
          <span className="bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400 bg-clip-text text-transparent">
            SIC BO
          </span>
        </h1>
        <p className="mt-3 text-sm font-medium text-slate-500">
          Pick Big or Small • Roll 3 Dice
        </p>
      </motion.div>

      {/* Play Button */}
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onPlay}
        disabled={loading || isWaiting}
        className={`
          flex items-center justify-center gap-3 px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-wide transition-all
          ${
            loading || isWaiting
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-[0_0_30px_rgba(251,146,60,0.4)] hover:shadow-amber-500/60'
          }
        `}
      >
        {loading || isWaiting ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full"
          />
        ) : (
          <Play fill="currentColor" size={20} />
        )}
        {loading ? 'Loading...' : isWaiting ? 'Authorizing...' : 'START GAME'}
      </motion.button>

      <div className="flex items-center gap-2 mt-8 text-xs font-medium text-slate-600">
        <Sparkles size={14} className="text-amber-500/50" />
        <span>Gasless • ERC-4337 Session Key</span>
      </div>
    </div>
  )
}
