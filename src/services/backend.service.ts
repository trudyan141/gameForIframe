import { SessionKeyData } from './erc4337.service'

export interface PlayParams {
  accountAddress: string
  isWin: boolean
  winAmount: number  // Positive if win, negative if lose
  diceValues: [number, number, number]
  total: number
  choice: 'big' | 'small'
}

export class BackendService {
  private static instance: BackendService
  private registeredSessions: Map<string, SessionKeyData> = new Map()

  private constructor() {}

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService()
    }
    return BackendService.instance
  }

  /**
   * Register a new session key with the backend
   */
  async registerSessionKey(sessionData: SessionKeyData): Promise<{ success: boolean; message: string }> {
    console.log('[Backend] Registering session key:', sessionData.sessionPublicKey)
    
    await new Promise(resolve => setTimeout(resolve, 800))
    
    this.registeredSessions.set(sessionData.sessionPublicKey.toLowerCase(), sessionData)
    
    return {
      success: true,
      message: 'Session key registered successfully'
    }
  }

  /**
   * Submit game result to backend for contract signing
   * FE already determined win/lose, BE just needs to execute the contract call
   */
  async submitPlay(params: PlayParams): Promise<{ success: boolean; message: string; txHash?: string }> {
    console.log('[Backend] Processing game result:', {
      account: params.accountAddress,
      isWin: params.isWin,
      amount: params.winAmount,
      dice: params.diceValues,
      total: params.total
    })
    
    // Simulate contract signing delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // In production: BE would use session key to sign UserOp
    // and call smart contract to transfer tokens based on result
    const txHash = '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
    
    console.log('[Backend] Contract signed. TxHash:', txHash)
    
    return {
      success: true,
      message: params.isWin ? 'Win processed!' : 'Loss processed.',
      txHash
    }
  }
}

export const backendService = BackendService.getInstance()
