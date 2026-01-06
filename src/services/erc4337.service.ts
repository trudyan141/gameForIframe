"use client"

import { ethers } from 'ethers'
import { 
  ENTRY_POINT_ABI, 
  FACTORY_ABI, 
  SIMPLE_ACCOUNT_ABI, 
  TOKEN_ABI, 
  PAYMASTER_ABI,
  ENTRY_POINT_ADDRESS,
  FACTORY_ADDRESS,
  TOKEN_ADDRESS,
  PAYMASTER_ADDRESS
} from '@/constants'
import { rpcUrl } from '@/config'

// ============================================
// TYPES
// ============================================

export interface UserOperation {
  sender: string
  nonce: string
  initCode: string
  callData: string
  accountGasLimits: string
  preVerificationGas: string
  gasFees: string
  paymasterAndData: string
  paymasterVerificationGasLimit?: string
  paymasterPostOpGasLimit?: string
  signature: string
}

export interface ERC4337Config {
  rpcUrl: string
  entryPointAddress: string
  factoryAddress: string
  tokenAddress: string
  paymasterAddress: string
  operatorPrivateKey?: string
}

export interface SessionKeyData {
  sessionPublicKey: string      // Public key của session
  sessionPrivateKey: string     // Private key (chỉ lưu trên client/iframe)
  validAfter: number            // Unix timestamp bắt đầu hiệu lực
  validUntil: number            // Unix timestamp hết hạn
  permissions: SessionPermission[]
  ownerSignature: string        // Chữ ký của owner xác nhận session
  accountAddress: string        // Abstract account address
}

export interface SessionPermission {
  target: string                // Contract được phép gọi
  selector: string              // Function selector (4 bytes)
  maxValue: string              // Max ETH value cho mỗi call
  maxUsage: number              // Số lần sử dụng tối đa
}

// ============================================
// DEFAULT CONFIG
// ============================================

export const defaultConfig: ERC4337Config = {
  rpcUrl,
  entryPointAddress: ENTRY_POINT_ADDRESS,
  factoryAddress: FACTORY_ADDRESS,
  tokenAddress: TOKEN_ADDRESS,
  paymasterAddress: PAYMASTER_ADDRESS
}

// ============================================
// ERC4337 SERVICE CLASS
// ============================================

export class ERC4337Service {
  private provider: ethers.JsonRpcProvider
  private operatorWallet: ethers.Wallet | null = null
  public config: ERC4337Config

  constructor(config: ERC4337Config = defaultConfig) {
    this.config = config
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
    if (config.operatorPrivateKey) {
      this.operatorWallet = new ethers.Wallet(config.operatorPrivateKey, this.provider)
    }
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider
  }

  // ============================================
  // ACCOUNT CREATION
  // ============================================

  /**
   * Tạo Abstract Account mới
   */
  async createAccount(ownerAddress: string, salt: number): Promise<{
    accountAddress: string
    txHash: string
    blockNumber: number
  }> {
    const response = await fetch('/api/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ownerAddress,
        salt,
        factoryAddress: this.config.factoryAddress
      })
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Failed to create account')
    }

    return {
      accountAddress: result.accountAddress,
      txHash: result.txHash,
      blockNumber: result.blockNumber
    }
  }

  /**
   * Lấy counterfactual address mà không cần deploy
   */
  async getAccountAddress(ownerAddress: string, salt: number): Promise<string> {
    const factory = new ethers.Contract(
      this.config.factoryAddress,
      FACTORY_ABI,
      this.provider
    )
    return await factory.getFunction('getAddress')(ownerAddress, salt)
  }

  // ============================================
  // TRANSFER
  // ============================================

  /**
   * Transfer token từ Abstract Account
   */
  async transferToken(
    ownerPrivateKey: string,
    senderAccount: string,
    recipientAddress: string,
    amount: string,
    usePaymaster: boolean = true
  ): Promise<{ txHash: string; blockNumber: number }> {
    const ownerWallet = new ethers.Wallet(ownerPrivateKey)
    const entryPoint = new ethers.Contract(
      this.config.entryPointAddress,
      ENTRY_POINT_ABI,
      this.provider
    )

    const tokenIface = new ethers.Interface(TOKEN_ABI)
    const simpleAccountIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI)
    const transferAmount = ethers.parseUnits(amount, 18)

    let callData: string
    let paymasterAndData = '0x'

    if (usePaymaster) {
      const paymasterContract = new ethers.Contract(
        this.config.paymasterAddress,
        PAYMASTER_ABI,
        this.provider
      )
      const requiredFee = await paymasterContract.requiredFee()

      const tTransfer = tokenIface.encodeFunctionData('transfer', [recipientAddress, transferAmount])
      const tPayFee = tokenIface.encodeFunctionData('transfer', [this.config.paymasterAddress, requiredFee])

      callData = simpleAccountIface.encodeFunctionData('executeBatch', [[
        { target: this.config.tokenAddress, value: 0, data: tTransfer },
        { target: this.config.tokenAddress, value: 0, data: tPayFee }
      ]])

      paymasterAndData = this.packPaymasterAndData(this.config.paymasterAddress, 200000, 200000)
    } else {
      const tTransfer = tokenIface.encodeFunctionData('transfer', [recipientAddress, transferAmount])
      callData = simpleAccountIface.encodeFunctionData('execute', [
        this.config.tokenAddress,
        0,
        tTransfer
      ])
    }

    const nonce = await entryPoint.getNonce(senderAccount, 0)

    const userOp = await this.buildAndSignUserOp({
      entry: entryPoint,
      sender: senderAccount,
      nonce,
      initCode: '0x',
      callData,
      owner: ownerWallet,
      paymasterAndData
    })

    return await this.submitUserOp(userOp)
  }

  // ============================================
  // BALANCE QUERIES
  // ============================================

  async getEntryPointDeposit(accountAddress: string): Promise<string> {
    const entryPoint = new ethers.Contract(
      this.config.entryPointAddress,
      ENTRY_POINT_ABI,
      this.provider
    )
    const balance = await entryPoint.balanceOf(accountAddress)
    return ethers.formatEther(balance)
  }

  async getTokenBalance(address: string): Promise<string> {
    const token = new ethers.Contract(
      this.config.tokenAddress,
      TOKEN_ABI,
      this.provider
    )
    const balance = await token.balanceOf(address)
    return ethers.formatUnits(balance, 18)
  }

  async getNativeBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address)
    return ethers.formatEther(balance)
  }

  // ============================================
  // HELPER FUNCTIONS (Public for SessionKeyManager)
  // ============================================

  async buildAndSignUserOp(params: {
    entry: ethers.Contract
    sender: string
    nonce: bigint | string
    initCode: string
    callData: string
    owner: ethers.Wallet
    paymasterAndData?: string
  }): Promise<UserOperation> {
    const {
      entry,
      sender,
      nonce,
      initCode,
      callData,
      owner,
      paymasterAndData = '0x'
    } = params

    const DEFAULT_VERIFICATION_GAS = 4_000_000
    const DEFAULT_CALL_GAS = 6_000_000
    const DEFAULT_PREVERIFICATION_GAS = 100_000
    const DEFAULT_PAYMASTER_VERIFICATION_GAS = 200_000
    const DEFAULT_PAYMASTER_POSTOP_GAS = 200_000

    const userOp: UserOperation = {
      sender,
      nonce: nonce.toString(),
      initCode,
      callData,
      accountGasLimits: this.packUint128Pair(
        BigInt(DEFAULT_VERIFICATION_GAS),
        BigInt(DEFAULT_CALL_GAS)
      ),
      preVerificationGas: DEFAULT_PREVERIFICATION_GAS.toString(),
      paymasterVerificationGasLimit: DEFAULT_PAYMASTER_VERIFICATION_GAS.toString(),
      paymasterPostOpGasLimit: DEFAULT_PAYMASTER_POSTOP_GAS.toString(),
      gasFees: this.packUint128Pair(
        ethers.parseUnits('1', 'gwei'),
        ethers.parseUnits('1', 'gwei')
      ),
      paymasterAndData,
      signature: '0x'
    }

    const userOpHash = await entry.getUserOpHash(userOp)
    const ownerSigningKey = new ethers.SigningKey(owner.privateKey)
    const ownerSig = ownerSigningKey.sign(userOpHash)
    userOp.signature = ethers.Signature.from(ownerSig).serialized

    return userOp
  }

  async submitUserOp(userOp: UserOperation): Promise<{
    txHash: string
    blockNumber: number
  }> {
    const response = await fetch('/api/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userOp,
        entryPointAddress: this.config.entryPointAddress
      })
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit UserOp')
    }

    return {
      txHash: result.txHash,
      blockNumber: result.blockNumber
    }
  }

  packUint128Pair(high: bigint, low: bigint): string {
    const hi = BigInt(high) << BigInt(128)
    const lo = BigInt(low)
    const val = hi | lo
    return '0x' + val.toString(16).padStart(64, '0')
  }

  packPaymasterAndData(
    paymasterAddress: string,
    validationGasLimit: bigint | number,
    postOpGasLimit: bigint | number,
    extraData = ''
  ): string {
    const addrNo0x = paymasterAddress.toLowerCase().replace(/^0x/, '')
    const valGasHex = BigInt(validationGasLimit).toString(16).padStart(32, '0')
    const postGasHex = BigInt(postOpGasLimit).toString(16).padStart(32, '0')
    return '0x' + addrNo0x + valGasHex + postGasHex + extraData.replace(/^0x/, '')
  }
}

// ============================================
// SESSION KEY MANAGER
// ============================================

export class SessionKeyManager {
  private service: ERC4337Service
  private activeSession: SessionKeyData | null = null

  constructor(service: ERC4337Service) {
    this.service = service
  }

  /**
   * Tạo Session Key mới (Cần owner key)
   * Gọi từ main app, không phải iframe
   */
  async createSessionKey(
    ownerPrivateKey: string,
    accountAddress: string,
    options: {
      validityDurationSeconds?: number
      permissions?: SessionPermission[]
    } = {}
  ): Promise<SessionKeyData> {
    const validityDuration = options.validityDurationSeconds || 3600 // 1 hour
    const now = Math.floor(Date.now() / 1000)
    const validAfter = now
    const validUntil = now + validityDuration

    // Generate session key pair
    const sessionWallet = ethers.Wallet.createRandom()

    // Default permissions
    const permissions = options.permissions || [
      {
        target: this.service.config.tokenAddress,
        selector: '0xa9059cbb', // transfer(address,uint256)
        maxValue: '0',
        maxUsage: 100
      }
    ]

    // Create session data hash
    const sessionDataHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ['address', 'uint256', 'uint256', 'address', 'bytes4[]'],
        [
          sessionWallet.address,
          validAfter,
          validUntil,
          accountAddress,
          permissions.map(p => p.selector)
        ]
      )
    )

    // Owner signs the session data
    const ownerWallet = new ethers.Wallet(ownerPrivateKey)
    const ownerSignature = await ownerWallet.signMessage(ethers.getBytes(sessionDataHash))

    const sessionData: SessionKeyData = {
      sessionPublicKey: sessionWallet.address,
      sessionPrivateKey: sessionWallet.privateKey,
      validAfter,
      validUntil,
      permissions,
      ownerSignature,
      accountAddress
    }

    this.activeSession = sessionData
    return sessionData
  }

  /**
   * Load session key từ storage (Dùng trong iframe)
   */
  loadSession(sessionData: SessionKeyData): boolean {
    const now = Math.floor(Date.now() / 1000)
    if (now < sessionData.validAfter || now > sessionData.validUntil) {
      console.error('Session expired or not yet valid')
      return false
    }
    this.activeSession = sessionData
    return true
  }

  /**
   * Get active session data
   */
  getSession(): SessionKeyData | null {
    return this.activeSession
  }

  /**
   * Clear active session
   */
  clearSession(): void {
    this.activeSession = null
  }

  /**
   * Thực hiện transfer bằng Session Key
   * KHÔNG cần owner private key
   * @param recipientAddress - Địa chỉ nhận
   * @param amount - Số lượng token
   * @param usePaymaster - Có sử dụng paymaster hay không (default: true)
   */
  async transferWithSessionKey(
    recipientAddress: string,
    amount: string,
    usePaymaster: boolean = true
  ): Promise<{ txHash: string; blockNumber: number }> {
    if (!this.activeSession) {
      throw new Error('No active session. Call loadSession() first.')
    }

    const now = Math.floor(Date.now() / 1000)
    if (now < this.activeSession.validAfter || now > this.activeSession.validUntil) {
      throw new Error('Session expired')
    }

    // Check permission
    const transferSelector = '0xa9059cbb'
    const hasPermission = this.activeSession.permissions.some(
      p => p.target.toLowerCase() === this.service.config.tokenAddress.toLowerCase() 
        && p.selector === transferSelector
    )
    if (!hasPermission) {
      throw new Error('Session does not have permission for this action')
    }

    const sessionWallet = new ethers.Wallet(this.activeSession.sessionPrivateKey)
    const entryPoint = new ethers.Contract(
      this.service.config.entryPointAddress,
      ENTRY_POINT_ABI,
      this.service.getProvider()
    )

    const tokenIface = new ethers.Interface(TOKEN_ABI)
    const simpleAccountIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI)
    const transferAmount = ethers.parseUnits(amount, 18)

    let callData: string
    let paymasterAndData = '0x'

    if (usePaymaster) {
      // Get required fee from paymaster
      const paymasterContract = new ethers.Contract(
        this.service.config.paymasterAddress,
        PAYMASTER_ABI,
        this.service.getProvider()
      )
      const requiredFee = await paymasterContract.requiredFee()

      // Encode 2 calls: transfer + pay fee to paymaster
      const tTransfer = tokenIface.encodeFunctionData('transfer', [recipientAddress, transferAmount])
      const tPayFee = tokenIface.encodeFunctionData('transfer', [this.service.config.paymasterAddress, requiredFee])

      callData = simpleAccountIface.encodeFunctionData('executeBatch', [[
        { target: this.service.config.tokenAddress, value: 0, data: tTransfer },
        { target: this.service.config.tokenAddress, value: 0, data: tPayFee }
      ]])

      paymasterAndData = this.service.packPaymasterAndData(
        this.service.config.paymasterAddress, 
        200000, 
        200000
      )
    } else {
      // Without paymaster - requires ETH for gas
      const tTransfer = tokenIface.encodeFunctionData('transfer', [recipientAddress, transferAmount])
      callData = simpleAccountIface.encodeFunctionData('execute', [
        this.service.config.tokenAddress,
        0,
        tTransfer
      ])
    }

    const nonce = await entryPoint.getNonce(this.activeSession.accountAddress, 0)

    const userOp = await this.buildUserOpWithSessionKey({
      entry: entryPoint,
      sender: this.activeSession.accountAddress,
      nonce,
      initCode: '0x',
      callData,
      sessionWallet,
      paymasterAndData
    })

    return await this.service.submitUserOp(userOp)
  }

  /**
   * Thực thi giao dịch tùy chỉnh bằng session key (dùng cho relay từ game)
   */
  async executeWithSessionKey(params: {
    target: string,
    value: string | number,
    calldata: string,
    paymasterAndData?: string
  }): Promise<{ txHash: string; blockNumber: number }> {
    if (!this.activeSession) throw new Error('No active session')

    const provider = this.service.getProvider()
    const sessionWallet = new ethers.Wallet(this.activeSession.sessionPrivateKey, provider)
    const entryPoint = new ethers.Contract(this.service.config.entryPointAddress, ENTRY_POINT_ABI, provider)
    const simpleAccountIface = new ethers.Interface(SIMPLE_ACCOUNT_ABI)

    const callData = simpleAccountIface.encodeFunctionData('execute', [
      params.target,
      params.value,
      params.calldata
    ])

    const nonce = await entryPoint.getNonce(this.activeSession.accountAddress, 0)

    const userOp = await this.buildUserOpWithSessionKey({
      entry: entryPoint,
      sender: this.activeSession.accountAddress,
      nonce,
      initCode: '0x',
      callData,
      sessionWallet,
      paymasterAndData: params.paymasterAndData
    })

    return await this.service.submitUserOp(userOp)
  }

  /**
   * Check if session is still valid
   */
  isSessionValid(): boolean {
    if (!this.activeSession) return false
    const now = Math.floor(Date.now() / 1000)
    return now >= this.activeSession.validAfter && now <= this.activeSession.validUntil
  }

  /**
   * Get remaining session time in seconds
   */
  getRemainingTime(): number {
    if (!this.activeSession) return 0
    const now = Math.floor(Date.now() / 1000)
    return Math.max(0, this.activeSession.validUntil - now)
  }

  /**
   * Format remaining time as string
   */
  getRemainingTimeFormatted(): string {
    const seconds = this.getRemainingTime()
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  private async buildUserOpWithSessionKey(params: {
    entry: ethers.Contract
    sender: string
    nonce: bigint | string
    initCode: string
    callData: string
    sessionWallet: ethers.Wallet
    paymasterAndData?: string
  }): Promise<UserOperation> {
    const { entry, sender, nonce, initCode, callData, sessionWallet, paymasterAndData = '0x' } = params

    if (!this.activeSession) {
      throw new Error('No active session')
    }

    const DEFAULT_VERIFICATION_GAS = 4_000_000
    const DEFAULT_CALL_GAS = 6_000_000
    const DEFAULT_PREVERIFICATION_GAS = 100_000
    const DEFAULT_PAYMASTER_VERIFICATION_GAS = 200_000
    const DEFAULT_PAYMASTER_POSTOP_GAS = 200_000

    const userOp: UserOperation = {
      sender,
      nonce: nonce.toString(),
      initCode,
      callData,
      accountGasLimits: this.service.packUint128Pair(
        BigInt(DEFAULT_VERIFICATION_GAS),
        BigInt(DEFAULT_CALL_GAS)
      ),
      preVerificationGas: DEFAULT_PREVERIFICATION_GAS.toString(),
      paymasterVerificationGasLimit: DEFAULT_PAYMASTER_VERIFICATION_GAS.toString(),
      paymasterPostOpGasLimit: DEFAULT_PAYMASTER_POSTOP_GAS.toString(),
      gasFees: this.service.packUint128Pair(
        ethers.parseUnits('1', 'gwei'),
        ethers.parseUnits('1', 'gwei')
      ),
      paymasterAndData,
      signature: '0x'
    }

    // Get UserOp hash
    const userOpHash = await entry.getUserOpHash(userOp)

    // Session key signs the UserOp
    const sessionSigningKey = new ethers.SigningKey(sessionWallet.privateKey)
    const sessionSig = sessionSigningKey.sign(userOpHash)

    // Combine: sessionSignature + ownerSignature + sessionData
    const packedSessionData = ethers.solidityPacked(
      ['bytes', 'bytes', 'uint48', 'uint48', 'address'],
      [
        ethers.Signature.from(sessionSig).serialized,
        this.activeSession.ownerSignature,
        this.activeSession.validAfter,
        this.activeSession.validUntil,
        this.activeSession.sessionPublicKey
      ]
    )

    userOp.signature = packedSessionData
    return userOp
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

let serviceInstance: ERC4337Service | null = null
let sessionManagerInstance: SessionKeyManager | null = null

export function getERC4337Service(config?: ERC4337Config): ERC4337Service {
  if (!serviceInstance) {
    serviceInstance = new ERC4337Service(config || defaultConfig)
  }
  return serviceInstance
}

export function getSessionKeyManager(): SessionKeyManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionKeyManager(getERC4337Service())
  }
  return sessionManagerInstance
}
