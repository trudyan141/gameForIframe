"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { TransactionLog, Log } from '@/components/TransactionLog'
import { PlayScreen } from '@/components/PlayScreen'
import { GameScreen } from '@/components/GameScreen'
import { backendService } from '@/services/backend.service'
import { ethers } from 'ethers'
import { rpcUrl } from '@/config'

// ========== DEMO MODE ==========
// Set to true to bypass parent iframe confirmation for testing
const DEMO_MODE = false
// ================================

export default function Home() {
  // Game State
  const [gameState, setGameState] = useState<'LOADING' | 'PLAY' | 'ROLL_DICE'>('LOADING')
  const [walletAddress, setWalletAddress] = useState('')
  const [isWaitingForParent, setIsWaitingForParent] = useState(false)
  const [tempOwnerPk, setTempOwnerPk] = useState('')
  const [walletStatus, setWalletStatus] = useState<'connected' | 'disconnected' | 'error' | 'loading'>('disconnected')
  const [tokenBalance, setTokenBalance] = useState('0')
  const [tokenAddress, setTokenAddress] = useState('')
  const tokenSymbol = 'USDT'
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

  // Listen for parent messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data
      if (!data) return

      if (data.type === 'WALLET_CONFIRMED') {
        const value = typeof data.value === 'string' ? JSON.parse(data.value) : data.value
        const { abstractAccountAddress, tokenAddress: tokenAddr, tx } = value
        
        addLog(`Parent confirmed! Tx: ${tx?.substring(0, 10)}...`, 'success')
        addLog(`Abstract Account: ${abstractAccountAddress.substring(0, 8)}...`, 'info')
        
        try {
          // Store addresses
          setWalletAddress(abstractAccountAddress)
          setTokenAddress(tokenAddr)
          
          // Fetch real USDT balance from tokenAddress
          const provider = new ethers.JsonRpcProvider(rpcUrl)
          const tokenContract = new ethers.Contract(
            tokenAddr,
            ['function balanceOf(address) view returns (uint256)'],
            provider
          )
          
          const balance = await tokenContract.balanceOf(abstractAccountAddress)
          const formattedBalance = ethers.formatUnits(balance, 6) // USDT is 6 decimals
          setTokenBalance(formattedBalance)
          
          addLog(`USDT Balance: ${formattedBalance}`, 'success')
          setRolling(false)
          setGameState('ROLL_DICE')
        } catch (err: any) {
          addLog(`Error: ${err.message}`, 'error')
        } finally {
          setIsWaitingForParent(false)
          setRolling(false)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [tempOwnerPk, addLog])

  // Landing logic
  useEffect(() => {
    setGameState('PLAY')
  }, [])

  // ============================================
  // SESSION KEY FLOW
  // ============================================

  const handlePlayGame = async () => {
    // DEMO MODE: Skip parent confirmation and go directly to game
    if (DEMO_MODE) {
      addLog('🎮 DEMO MODE: Skipping parent confirmation', 'info')
      // Create wallet even in demo mode for signing
      const demoWallet = ethers.Wallet.createRandom()
      setTempOwnerPk(demoWallet.privateKey)
      setWalletAddress(demoWallet.address)
      setGameState('ROLL_DICE')
      return
    }

    setRolling(true)
    addLog('Creating wallet...')

    try {
      // Create random wallet
      const randomWallet = ethers.Wallet.createRandom()
      const walletPrivateKey = randomWallet.privateKey
      const walletAddress = randomWallet.address
      
      // Store private key for signing later
      setTempOwnerPk(walletPrivateKey)
      
      addLog(`Wallet created: ${walletAddress.substring(0, 8)}...`, 'success')
      addLog('Waiting for parent authorization...', 'info')

      // Send wallet address to parent
      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'WALLET_CREATED', 
          value: JSON.stringify({ 
            walletAddress: walletAddress
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
      const diceValues: [number, number, number] = [dice1, dice2, dice3]
      
      setDiceValues(diceValues)

      // Determine win: Big = 11-17, Small = 4-10
      const isBig = total >= 11
      const isWin = (choice === 'big' && isBig) || (choice === 'small' && !isBig)
      const winAmount = isWin ? amount : -amount

      // Update local balance
      const currentBalance = parseFloat(tokenBalance)
      const newBalance = currentBalance + winAmount
      setTokenBalance(newBalance.toFixed(0))

      setGameResult({
        success: true,
        message: isWin ? 'Win!' : 'Lose!',
        isWin,
        total
      })

      if (isWin) {
        addLog(`🎉 WIN! Dice: [${diceValues.join(', ')}] = ${total} (${isBig ? 'BIG' : 'SMALL'})`, 'success')
        addLog(`+${amount} ${tokenSymbol} added to balance`, 'success')
      } else {
        addLog(`😢 LOSE! Dice: [${diceValues.join(', ')}] = ${total} (${isBig ? 'BIG' : 'SMALL'})`, 'error')
        addLog(`-${amount} ${tokenSymbol} deducted from balance`, 'error')
      }

      // Submit result to backend for contract signing
      addLog(`Submitting to BE: ${walletAddress.substring(0, 8)}... | ${isWin ? 'WIN' : 'LOSE'} ${winAmount}`, 'info')
      const beResult = await backendService.submitPlay({
        accountAddress: walletAddress,
        isWin,
        winAmount,
        diceValues,
        total,
        choice
      })

      if (beResult.success) {
        addLog(`✅ Contract signed! Tx: ${beResult.txHash?.substring(0, 16)}...`, 'success')
      }

      // Notify parent with result
      if (window.parent !== window) {
        window.parent.postMessage({ 
          type: 'GAME_PLAY_RESULT', 
          value: JSON.stringify({ 
            isWin, 
            diceValues,
            total,
            choice,
            winAmount,
            txHash: beResult.txHash
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
      <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Game Card */}
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

        {/* Right: Activity Feed */}
        <div className="glass rounded-3xl p-6 border-glow">
          <TransactionLog logs={logs} />
        </div>
      </div>
    </main>
  )
}
