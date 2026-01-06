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
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Terminal size={14} className="text-slate-500" />
        <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-500">Activity Feed</h3>
      </div>
      
      <div className="flex-1 space-y-2 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Terminal size={24} className="text-slate-700 mb-2" />
            <p className="text-xs text-slate-600">No activity yet</p>
            <p className="text-[10px] text-slate-700 mt-1">Start playing to see logs here</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 group transition-colors hover:bg-white/[0.08]">
              <div className={`mt-0.5 flex-shrink-0 ${
                log.type === 'success' ? 'text-emerald-400' : 
                log.type === 'error' ? 'text-rose-400' : 'text-sky-400'
              }`}>
                {log.type === 'success' ? <CheckCircle2 size={14} /> : 
                 log.type === 'error' ? <AlertCircle size={14} /> : 
                 <Info size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-300 leading-relaxed break-words">
                  {log.message}
                </p>
                <span className="text-[9px] font-mono text-slate-600">{log.timestamp}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
