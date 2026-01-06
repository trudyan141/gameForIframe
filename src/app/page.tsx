"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { TransactionLog, Log } from '@/components/TransactionLog'
import { PlayScreen } from '@/components/PlayScreen'
import { GameScreen } from '@/components/GameScreen'
import { getERC4337Service, getSessionKeyManager } from '@/services/erc4337.service'
import { backendService } from '@/services/backend.service'
import { ethers } from 'ethers'
import { 
  ENTRY_POINT_ADDRESS, 
  FACTORY_ADDRESS, 
  TOKEN_ADDRESS, 
  PAYMASTER_ADDRESS 
} from '@/constants'
import { rpcUrl } from '@/config'

export default function Home() {
  // Game State
  const [gameState, setGameState] = useState<'LOADING' | 'PLAY' | 'ROLL_DICE'>('LOADING')
  const [walletAddress, setWalletAddress] = useState('')
  const [isWaitingForParent, setIsWaitingForParent] = useState(false)
  const [tempOwnerPk, setTempOwnerPk] = useState('')
  const [walletStatus, setWalletStatus] = useState<'connected' | 'disconnected' | 'error' | 'loading'>('disconnected')
  const [tokenBalance, setTokenBalance] = useState('1000')
  const tokenSymbol = 'CHIP'
  const [logs, setLogs] = useState<Log[]>([])
  
  // Game Play State
  const [rolling, setRolling] = useState(false)
  const [diceValues, setDiceValues] = useState<[number, number, number]>([1, 1, 1])
  const [gameResult, setGameResult] = useState<{ success: boolean; message: string; isWin: boolean; total: number } | null>(null)

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const newLog: Log = {
      id: Math.random().toString(36).substring(7),
      message,
      type,
      timestamp: new Date().toLocaleTimeString(),
    }
    setLogs((prev) => [newLog, ...prev])
    console.log(`[Game] ${message}`)
  }, [])

  // ============================================
  // WALLET INITIALIZATION
  // ============================================

  const initializeWallet = useCallback(async (pk: string, address: string) => {
    setWalletStatus('loading')
    addLog('Initializing wallet...')
    
    try {
      getERC4337Service({
        operatorPrivateKey: pk,
        rpcUrl: rpcUrl,
        entryPointAddress: ENTRY_POINT_ADDRESS,
        factoryAddress: FACTORY_ADDRESS,
        tokenAddress: TOKEN_ADDRESS,
        paymasterAddress: PAYMASTER_ADDRESS
      })
      
      setWalletAddress(address)
      setWalletStatus('connected')
      addLog(`Wallet connected: ${address.substring(0, 8)}...`, 'success')
    } catch (error: any) {
      setWalletStatus('error')
      addLog(`Init error: ${error.message}`, 'error')
      throw error
    }
  }, [addLog])

  // Listen for parent messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data
      if (!data) return

      if (data.type === 'SESSION_CONFIRMED') {
        const value = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
        const address = value.address || value.accountAddress
        
        addLog(`Parent confirmed wallet: ${address}`, 'success')
        
        try {
          await initializeWallet(tempOwnerPk, address)
          
          const sessionManager = getSessionKeyManager()
          const session = sessionManager.getSession()
          if (session) {
            const regResult = await backendService.registerSessionKey(session)
            if (regResult.success) {
              addLog('Session registered!', 'success')
              setGameState('ROLL_DICE')
            }
          }
        } catch (err: any) {
          addLog(`Confirmation error: ${err.message}`, 'error')
        } finally {
          setIsWaitingForParent(false)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [initializeWallet, tempOwnerPk, addLog])

  // Landing logic
  useEffect(() => {
    setGameState('PLAY')
  }, [])

  // ============================================
  // SESSION KEY FLOW
  // ============================================

  const handlePlayGame = async () => {
    setRolling(true)
    addLog('Creating game session...')

    try {
      const randomWallet = ethers.Wallet.createRandom()
      const ownerPk = randomWallet.privateKey
      setTempOwnerPk(ownerPk)

      const service = getERC4337Service()
      const accountAddress = await service.getAccountAddress(randomWallet.address, 0)
      
      const sessionManager = getSessionKeyManager()
      const session = await sessionManager.createSessionKey(ownerPk, accountAddress)
      
      addLog('Session created. Awaiting authorization...', 'info')

      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'CREATE_SESSION', 
          value: JSON.stringify({ 
            ownerPublicKey: randomWallet.address,
            sessionPublicKey: session.sessionPublicKey,
            accountAddress: accountAddress,
            validUntil: session.validUntil
          }) 
        }, '*')
      }

      setIsWaitingForParent(true)
    } catch (error: any) {
      addLog(`Error: ${error.message}`, 'error')
      setRolling(false)
    }
  }

  // ============================================
  // SIC BO GAME LOGIC
  // ============================================

  const handleRollDice = async (amount: number, choice: 'big' | 'small') => {
    setRolling(true)
    setGameResult(null)
    addLog(`Betting ${amount} ${tokenSymbol} on ${choice.toUpperCase()}...`)

    try {
      // Simulate rolling animation delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      // Generate 3 random dice values
      const dice1 = Math.floor(Math.random() * 6) + 1
      const dice2 = Math.floor(Math.random() * 6) + 1
      const dice3 = Math.floor(Math.random() * 6) + 1
      const total = dice1 + dice2 + dice3
      
      setDiceValues([dice1, dice2, dice3])

      // Determine win: Big = 11-17, Small = 4-10
      const isBig = total >= 11
      const isWin = (choice === 'big' && isBig) || (choice === 'small' && !isBig)

      // Update balance
      const currentBalance = parseFloat(tokenBalance)
      const newBalance = isWin ? currentBalance + amount : currentBalance - amount
      setTokenBalance(newBalance.toFixed(0))

      setGameResult({
        success: true,
        message: isWin ? 'Win!' : 'Lose!',
        isWin,
        total
      })

      if (isWin) {
        addLog(`WIN! Total: ${total} (${isBig ? 'BIG' : 'SMALL'}). +${amount} ${tokenSymbol}`, 'success')
      } else {
        addLog(`LOSE! Total: ${total} (${isBig ? 'BIG' : 'SMALL'}). -${amount} ${tokenSymbol}`, 'error')
      }

      // Notify parent
      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'GAME_PLAY_RESULT', 
          value: JSON.stringify({ 
            isWin, 
            diceValues: [dice1, dice2, dice3],
            total,
            choice
          }) 
        }, '*')
      }
    } catch (error: any) {
      addLog(`Error: ${error.message}`, 'error')
      setGameResult({
        success: false,
        message: error.message,
        isWin: false,
        total: 0
      })
    } finally {
      setRolling(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Main Game Card */}
        <div className="glass rounded-3xl p-6 border-glow">
          {gameState === 'PLAY' && (
            <PlayScreen 
              onPlay={handlePlayGame} 
              loading={rolling} 
              isWaiting={isWaitingForParent} 
            />
          )}

          {gameState === 'ROLL_DICE' && (
            <GameScreen
              onRoll={handleRollDice}
              rolling={rolling}
              diceValues={diceValues}
              balanceToken={parseFloat(tokenBalance)}
              tokenSymbol={tokenSymbol}
              result={gameResult}
            />
          )}

          {gameState === 'LOADING' && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
              <p className="text-slate-500 text-sm">Loading...</p>
            </div>
          )}
        </div>

        {/* Activity Log */}
        <TransactionLog logs={logs} />
      </div>
    </main>
  )
}
