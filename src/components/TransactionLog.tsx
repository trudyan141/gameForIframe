"use client"

import React from 'react'
import { Terminal, CheckCircle2, AlertCircle, Info } from 'lucide-react'

export interface Log {
  id: string
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: string
}

interface TransactionLogProps {
  logs: Log[]
}

export const TransactionLog: React.FC<TransactionLogProps> = ({ logs }) => {
  return (
    <div className="w-full max-w-lg mx-auto mt-8 border-t border-white/5 pt-6">
      <div className="flex items-center gap-2 mb-4 px-1">
        <Terminal size={14} className="text-slate-500" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Activity Feed</h3>
      </div>
      
      <div className="space-y-2 h-[100px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {logs.length === 0 ? (
          <p className="text-[10px] text-slate-700 italic px-1">Awaiting interaction...</p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/5 group transition-colors hover:bg-white/[0.08]">
              <div className={`mt-0.5 ${
                log.type === 'success' ? 'text-emerald-400' : 
                log.type === 'error' ? 'text-rose-400' : 'text-sky-400'
              }`}>
                {log.type === 'success' ? <CheckCircle2 size={12} /> : 
                 log.type === 'error' ? <AlertCircle size={12} /> : 
                 <Info size={12} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-slate-300 leading-relaxed truncate group-hover:whitespace-normal">
                  {log.message}
                </p>
              </div>
              <span className="text-[9px] font-mono text-slate-600 mt-0.5">{log.timestamp}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
