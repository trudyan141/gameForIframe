import { SessionKeyData } from './erc4337.service'

export interface PlayParams {
  accountAddress: string
  betAmount: number
  diceResult?: number
  signature: string
  timestamp: number
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
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800))
    
    this.registeredSessions.set(sessionData.sessionPublicKey.toLowerCase(), sessionData)
    
    return {
      success: true,
      message: 'Session key registered successfully'
    }
  }

  /**
   * Submit a dice roll game play
   */
  async submitPlay(params: PlayParams): Promise<{ success: boolean; result?: number; message: string; txHash?: string }> {
    console.log('[Backend] Submitting play for account:', params.accountAddress)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Simulate API delay
    // Simulate game logic
    const diceResult = Math.floor(Math.random() * 6) + 1
    const isWin = diceResult >= 4
    
    // In a real system, the BE would sign a UserOp or trigger a contract call
    // using the session key information it has stored.
    
    return {
      success: true,
      result: diceResult,
      message: isWin ? 'You won!' : 'You lost.',
      txHash: '0x' + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2)
    }
  }
}

export const backendService = BackendService.getInstance()
