"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { TransactionLog, Log } from '@/components/TransactionLog'
import { PlayScreen } from '@/components/PlayScreen'
import { GameScreen } from '@/components/GameScreen'
import { defaultBackendService } from '@/services/backend.service'
import { ethers } from 'ethers'
import { rpcUrl } from '@/config'
import { 
  ENTRY_POINT_ADDRESS, 
  TOKEN_ADDRESS, 
  PAYMASTER_ADDRESS, 
  DELEGATOR_ADDRESS,
  TOKEN_ABI, 
  DELEGATION_ACCOUNT_ABI, 
  STAKING_ABI, 
  PAYMASTER_ABI 
} from '@/constants'

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
  const [payRewardAddress, setPayRewardAddress] = useState(PAYMASTER_ADDRESS)

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

  const handleRefreshBalance = useCallback(async () => {
    if (!walletAddress || !tokenAddress) {
      addLog('Wallet not connected', 'error')
      return
    }

    addLog('Refreshing balance...', 'info')
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      )
      
      const balance = await tokenContract.balanceOf(walletAddress)
      const formattedBalance = ethers.formatUnits(balance, 18) // USDT is 18 decimals
      setTokenBalance(formattedBalance)
      addLog(`Balance updated: ${formattedBalance} ${tokenSymbol}`, 'success')
    } catch (err: any) {
      addLog(`Refresh error: ${err.message}`, 'error')
    }
  }, [walletAddress, tokenAddress, addLog, tokenSymbol])

  // Listen for parent messages
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const data = event.data
      if (!data) return

      if (data.type === 'WALLET_CONFIRMED') {
        const value = (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) as { 
          status: string; 
          abstractAccountAddress: string; 
          tokenAddress: string; 
          tx: string; 
          error?: string 
        }
        const { status, abstractAccountAddress, tokenAddress: tokenAddr, tx, error } = value
        
        if (status === 'FAIL') {
          addLog(`❌ Parent confirmation failed: ${error || 'Unknown error'}`, 'error')
          setRolling(false)
          setIsWaitingForParent(false)
          return
        }

        addLog(`Parent confirmed! Tx: ${tx?.substring(0, 10)}...`, 'success')
        addLog(`Abstract Account: ${abstractAccountAddress?.substring(0, 8)}...`, 'info')
        
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
          const formattedBalance = ethers.formatUnits(balance, 18) // USDT is 18 decimals
          setTokenBalance(formattedBalance)
          
          addLog(`USDT Balance: ${formattedBalance}`, 'success')
          setRolling(false)
          setGameState('ROLL_DICE')
        } catch (error) {
          const err = error as Error
          addLog(`Error: ${err.message}`, 'error')
        } finally {
          setIsWaitingForParent(false)
          setRolling(false)
        }
      }

      if (data.type === 'REWARD_SENT') {
        const value = (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) as {
          status: 'success' | 'failure';
          txHash?: string;
          rewardAmount?: string | number;
          error?: string;
        }

        if (value.status === 'success') {
          addLog(`🎁 Reward received: ${value.rewardAmount} USDT. TX: ${value.txHash?.substring(0, 10)}...`, 'success')
          handleRefreshBalance()
        } else {
          addLog(`❌ Reward failed: ${value.error || 'Unknown error'}`, 'error')
        }
      }

      if (data.type === 'HOUSE_CHANGED') {
        const value = (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) as {
          addressPaysReward: string;
        }
        if (value.addressPaysReward) {
          setPayRewardAddress(value.addressPaysReward)
          addLog(`🏠 House updated: ${value.addressPaysReward.substring(0, 10)}...`, 'info')
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [tempOwnerPk, addLog, handleRefreshBalance])

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
    } catch (error) {
      const err = error as Error
      addLog(`Error: ${err.message}`, 'error')
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

      // Local balance update removed - we will sync from blockchain after BE submission
      // to ensure consistency and avoid calculation mismatches.

      setGameResult({
        success: true,
        message: isWin ? 'Win!' : 'Lose!',
        isWin,
        total
      })

      if (isWin) {
        addLog(`🎉 WIN! Dice: [${diceValues.join(', ')}] = ${total} (${isBig ? 'BIG' : 'SMALL'})`, 'success')
      } else {
        addLog(`😢 LOSE! Dice: [${diceValues.join(', ')}] = ${total} (${isBig ? 'BIG' : 'SMALL'})`, 'error')
      }

      // Submit result to backend for UserOp execution (Background)
      submitResultToBE(amount, isWin).catch(err => {
        addLog(`Backend sync failed: ${err.message}`, 'error')
      })

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
          }) 
        }, '*')
      }
    } catch (error) {
      const err = error as Error
      addLog(`Game Error: ${err.message}`, 'error')
      // Only set error result if we haven't calculated dice values yet
      if (!gameResult) {
        setGameResult({
          success: false,
          message: err.message,
          isWin: false,
          total: 0
        })
      }
    } finally {
      setRolling(false)
    }
  }

  const submitResultToBE = async (amount: number, isWin: boolean) => {
    if (!walletAddress || !tempOwnerPk) {
      addLog('Missing wallet info for BE submission', 'error')
      return
    }

    try {
      addLog(`Building UserOperation for ${isWin ? 'WIN' : 'LOSS'}...`, 'info')
      
      const provider = new ethers.JsonRpcProvider(rpcUrl)
        // Build callData locally
      const delegationAccountIface = new ethers.Interface(DELEGATION_ACCOUNT_ABI)
      const tokenIface = new ethers.Interface(TOKEN_ABI)
      const paymasterContract = new ethers.Contract(PAYMASTER_ADDRESS, PAYMASTER_ABI, provider)

      // Get required fee from paymaster
      const requiredTokenFee = await paymasterContract.requiredFee()
      console.log(`Required paymaster fee: ${ethers.formatUnits(requiredTokenFee, 18)} tokens`)

      // Prepare transfer amounts
      const transferAmount = ethers.parseUnits(amount.toString(), 18)
      console.log(`transferAmount: ${transferAmount}`)
      // Encode transfer calldata (to recipient)
      console.log(`payRewardAddress: ${payRewardAddress}`) // casino house selected that will receive the bet amount and pay reward when win
      console.log(`requiredTokenFee: ${requiredTokenFee}`)
      const tTransfer = tokenIface.encodeFunctionData('transfer', [payRewardAddress, transferAmount])
      
      // Encode paymaster fee calldata
      const tPayFee = tokenIface.encodeFunctionData('transfer', [PAYMASTER_ADDRESS, requiredTokenFee])

      // Build executeBatch callData with both transfers
      const callData = delegationAccountIface.encodeFunctionData('executeBatch', [[
          { target: TOKEN_ADDRESS, value: 0, data: tTransfer },
          { target: TOKEN_ADDRESS, value: 0, data: tPayFee }
      ]])

      // Step 1: Request backend to build UserOp
      const buildResult = await defaultBackendService.buildUserOp({
        senderAddress: walletAddress,
        callData,
      })

      const userOpHash = buildResult.userOpHash 
      
      if (!userOpHash) {
        addLog('BE build failed: No UserOp hash returned', 'error')
        return
      }

      addLog(`✓ UserOp built. Hash: ${userOpHash.substring(0, 16)}...`, 'success')

      // Step 2: Sign UserOp hash with local session wallet (tempOwnerPk)
      const wallet = new ethers.Wallet(tempOwnerPk)
      const signature = await wallet.signMessage(ethers.getBytes(userOpHash))
      addLog('✓ Signature created', 'success')

      // Step 3: Attach signature and submit
      const signedUserOp = {
        ...buildResult.userOp,
        signature,
      }

      addLog('Submitting UserOperation to operator...', 'info')
      const result = await defaultBackendService.submitUserOp({
        userOp: signedUserOp,
        entryPointAddress: ENTRY_POINT_ADDRESS,
      })

      if (result.success) {
        addLog(`✅ Game result on-chain! Tx: ${result.txHash.substring(0, 16)}...`, 'success')
        // Automatically refresh balance from blockchain
        await handleRefreshBalance()
      }
    } catch (error) {
      const err = error as Error
      addLog(`BE Error: ${err.message}`, 'error')
      throw error
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
              onRefresh={handleRefreshBalance}
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
