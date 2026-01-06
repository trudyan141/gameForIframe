"use client"

import React from 'react'
import { Wallet, Globe, Coins, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'

interface StatusBoxProps {
  walletStatus: 'connected' | 'disconnected' | 'error' | 'loading'
  walletAddress: string
  balanceEth: string
  balanceToken: string
  tokenSymbol: string
}

export const StatusBox: React.FC<StatusBoxProps> = ({
  walletStatus,
  walletAddress,
  balanceEth,
  balanceToken,
  tokenSymbol,
}) => {
  const statusConfig = {
    connected: { icon: <ShieldCheck className="w-4 h-4" />, text: 'Secure', className: 'text-emerald-400' },
    disconnected: { icon: <AlertCircle className="w-4 h-4" />, text: 'Disconnected', className: 'text-rose-400' },
    error: { icon: <AlertCircle className="w-4 h-4" />, text: 'Error', className: 'text-rose-400' },
    loading: { icon: <Loader2 className="w-4 h-4 animate-spin" />, text: 'Connecting...', className: 'text-sky-400' },
  }

  const currentStatus = statusConfig[walletStatus] || statusConfig.disconnected

  return (
    <div className="glass rounded-2xl p-4 mb-6 border-glow">
      <div className="grid grid-cols-2 gap-4">
        {/* Status & Wallet */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg bg-white/5 ${currentStatus.className}`}>
              {currentStatus.icon}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Status</p>
              <p className={`text-xs font-bold ${currentStatus.className}`}>{currentStatus.text}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-sky-400">
              <Wallet className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Address</p>
              <p className="text-xs font-mono text-slate-200 truncate pr-2">
                {walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(38)}` : 'No Wallet'}
              </p>
            </div>
          </div>
        </div>

        {/* Balances */}
        <div className="space-y-3 border-l border-white/5 pl-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-amber-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Network</p>
              <p className="text-xs font-bold text-slate-200">MegaETH</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/5 text-emerald-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Balance</p>
              <p className="text-xs font-bold">
                <span className="text-slate-200">{balanceToken}</span>
                <span className="text-emerald-400 ml-1">{tokenSymbol}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
