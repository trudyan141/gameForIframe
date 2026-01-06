"use client"

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Coins, TrendingUp, TrendingDown, Trophy, Frown } from 'lucide-react'
import { Dice } from './Dice'

interface GameScreenProps {
  onRoll: (amount: number, choice: 'big' | 'small') => void
  rolling: boolean
  diceValues: [number, number, number]
  balanceToken: number
  tokenSymbol: string
  result: { success: boolean; message: string; isWin: boolean; total: number } | null
}

export const GameScreen: React.FC<GameScreenProps> = ({
  onRoll,
  rolling,
  diceValues,
  balanceToken,
  tokenSymbol,
  result,
}) => {
  const [betAmount, setBetAmount] = useState('10')
  const [choice, setChoice] = useState<'big' | 'small' | null>(null)

  const handleRoll = () => {
    const amount = parseFloat(betAmount)
    if (isNaN(amount) || amount <= 0 || amount > balanceToken || !choice) return
    onRoll(amount, choice)
  }

  const presets = [10, 50, 100]
  const total = diceValues[0] + diceValues[1] + diceValues[2]

  return (
    <div className="flex flex-col items-center py-6 space-y-6">
      {/* Dice Display */}
      <div className="relative flex items-center justify-center gap-4 min-h-[120px]">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-violet-500/10 blur-3xl rounded-full" />
        
        {diceValues.map((val, i) => (
          <Dice key={i} value={val} rolling={rolling} delay={i * 0.1} />
        ))}
      </div>

      {/* Result Display */}
      <AnimatePresence>
        {result && !rolling && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`flex flex-col items-center gap-2 px-8 py-4 rounded-2xl border ${
              result.isWin 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {result.isWin ? <Trophy size={24} /> : <Frown size={24} />}
              <span className="text-2xl font-black">{result.isWin ? 'YOU WIN!' : 'YOU LOSE!'}</span>
            </div>
            <div className="text-sm font-bold text-slate-400">
              Total: <span className={`text-lg ${result.total >= 11 ? 'text-amber-400' : 'text-violet-400'}`}>{result.total}</span> 
              <span className="ml-2">({result.total >= 11 ? 'BIG' : 'SMALL'})</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Choice Selection */}
      <div className="w-full max-w-xs space-y-4">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Choose Your Bet</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setChoice('small')}
            disabled={rolling}
            className={`py-4 rounded-2xl font-black text-lg uppercase transition-all border-2 ${
              choice === 'small'
                ? 'bg-violet-500 border-violet-400 text-white shadow-[0_0_20px_rgba(139,92,246,0.5)]'
                : 'bg-violet-500/10 border-violet-500/20 text-violet-400 hover:bg-violet-500/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingDown size={20} />
              <span>Small</span>
            </div>
            <p className="text-[10px] font-medium opacity-70 mt-1">3 - 10</p>
          </button>
          
          <button
            onClick={() => setChoice('big')}
            disabled={rolling}
            className={`py-4 rounded-2xl font-black text-lg uppercase transition-all border-2 ${
              choice === 'big'
                ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <TrendingUp size={20} />
              <span>Big</span>
            </div>
            <p className="text-[10px] font-medium opacity-70 mt-1">11 - 18</p>
          </button>
        </div>
      </div>

      {/* Bet Amount */}
      <div className="w-full max-w-xs space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Bet Amount</span>
          <span className="text-[10px] font-bold text-slate-600">
            Balance: {balanceToken.toFixed(0)} {tokenSymbol}
          </span>
        </div>
        
        <div className="relative">
          <Coins size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            disabled={rolling}
            className="w-full bg-black/30 border border-white/10 focus:border-amber-500/50 outline-none rounded-xl py-3 pl-10 pr-4 font-bold text-white text-center"
            placeholder="0"
          />
        </div>

        <div className="flex gap-2">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setBetAmount(p.toString())}
              disabled={rolling}
              className="flex-1 py-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-xs font-bold text-slate-400 transition-all"
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setBetAmount(balanceToken.toString())}
            disabled={rolling}
            className="flex-1 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-xs font-bold text-rose-400 transition-all"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Roll Button */}
      <button
        onClick={handleRoll}
        disabled={rolling || !choice || parseFloat(betAmount) <= 0 || parseFloat(betAmount) > balanceToken}
        className={`
          w-full max-w-xs py-5 rounded-2xl font-black text-lg uppercase tracking-wide flex items-center justify-center gap-3 transition-all
          ${
            rolling || !choice || parseFloat(betAmount) <= 0 || parseFloat(betAmount) > balanceToken
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-[0_0_25px_rgba(251,146,60,0.4)] hover:shadow-amber-500/60'
          }
        `}
      >
        {rolling ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
            ROLLING...
          </>
        ) : (
          <>
            🎲 ROLL DICE
          </>
        )}
      </button>
    </div>
  )
}
