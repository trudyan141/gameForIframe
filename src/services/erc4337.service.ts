"use client"

import { ethers } from 'ethers'
import { 
  ENTRY_POINT_ABI, 
  FACTORY_ABI, 
  SIMPLE_ACCOUNT_ABI, 
  TOKEN_ABI, 
  PAYMASTER_ABI,
  DELEGATOR_ABI,
  DELEGATION_ACCOUNT_ABI,
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

  // ============================================
  // USER OP BUILDERS (Generic & Specific)
  // ============================================

  /**
   * Generic builder for batch operations.
   * Automatically appends the Paymaster fee payment call.
   */
  async createBatchUserOp(params: {
    sender: string,
    nonce: string,
    calls: { target: string; value: bigint; data: string }[],
    paymasterAddress: string,
    requiredFee: bigint,
    tokenAddress: string,
    isDeployed?: boolean
  }): Promise<UserOperation> {
    const {
      sender,
      nonce,
      calls,
      paymasterAddress,
      requiredFee,
      tokenAddress,
      isDeployed = true
    } = params

    const tokenIface = new ethers.Interface(TOKEN_ABI)
    const delegationAccountIface = new ethers.Interface(DELEGATION_ACCOUNT_ABI)

    // Append Paymaster Fee call
    const payFeeData = tokenIface.encodeFunctionData('transfer', [
      paymasterAddress,
      requiredFee,
    ])
    
    // Final list of calls
    const finalCalls = [
      ...calls,
      { target: tokenAddress, value: BigInt(0), data: payFeeData }
    ]

    // Build executeBatch calldata
    const callData = delegationAccountIface.encodeFunctionData('executeBatch', [
      finalCalls.map(c => ({
        target: c.target,
        value: c.value,
        data: c.data
      }))
    ])

    // Pack paymaster data
    const paymasterAndData = this.packPaymasterAndData(paymasterAddress, 200000, 200000)

    // Build UserOp
    return {
      sender,
      nonce,
      initCode: isDeployed ? '0x' : '0x',
      callData,
      accountGasLimits: this.packUint128Pair(BigInt(4_000_000), BigInt(6_000_000)),
      preVerificationGas: '100000',
      paymasterVerificationGasLimit: '200000',
      paymasterPostOpGasLimit: '200000',
      gasFees: this.packUint128Pair(ethers.parseUnits('1', 'gwei'), ethers.parseUnits('1', 'gwei')),
      paymasterAndData,
      signature: '0x'
    }
  }

  /**
   * Specific builder: Revoke Session
   */
  async createRevokeSessionUserOp(params: {
    sender: string,
    nonce: string,
    sessionAddress: string,
    paymasterAddress: string,
    requiredFee: bigint,
    delegatorAddress: string,
    tokenAddress: string,
    isDeployed?: boolean
  }): Promise<UserOperation> {
    const { sessionAddress, delegatorAddress } = params
    const delegatorIface = new ethers.Interface(DELEGATOR_ABI)

    const removeDelegatorData = delegatorIface.encodeFunctionData('removeDelegatorOnBehalfOf', [
      sessionAddress,
    ])

    return this.createBatchUserOp({
      ...params,
      calls: [{ target: delegatorAddress, value: BigInt(0), data: removeDelegatorData }]
    })
  }

  /**
   * Specific builder: Transfer Token
   */
  async createTransferUserOp(params: {
    sender: string,
    nonce: string,
    recipient: string,
    amount: bigint,
    paymasterAddress: string,
    requiredFee: bigint,
    tokenAddress: string,
    isDeployed?: boolean
  }): Promise<UserOperation> {
    const { recipient, amount, tokenAddress } = params
    const tokenIface = new ethers.Interface(TOKEN_ABI)

    const transferData = tokenIface.encodeFunctionData('transfer', [
      recipient,
      amount
    ])

    return this.createBatchUserOp({
      ...params,
      calls: [{ target: tokenAddress, value: BigInt(0), data: transferData }]
    })
  }

  /**
   * Specific builder: Add Delegator (Login)
   */
  async createAddDelegatorUserOp(params: {
    sender: string,
    nonce: string,
    sessionAddress: string,
    expiryDuration: number,
    paymasterAddress: string,
    requiredFee: bigint,
    delegatorAddress: string,
    tokenAddress: string,
    isDeployed?: boolean
  }): Promise<UserOperation> {
    const { sessionAddress, expiryDuration, delegatorAddress } = params
    const delegatorIface = new ethers.Interface(DELEGATOR_ABI)

    // Calculate absolute timestamp (current + duration)
    // Note: This assumes the client time is synced enough. 
    // Ideally this comes from a time server or block time, but roughly ok for client.
    const validUntil = Math.floor(Date.now() / 1000) + expiryDuration
    
    const addDelegatorData = delegatorIface.encodeFunctionData('addDelegatorWithExpiry', [
      sessionAddress,
      validUntil
    ])

    return this.createBatchUserOp({
      ...params,
      calls: [{ target: delegatorAddress, value: BigInt(0), data: addDelegatorData }]
    })
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

let serviceInstance: ERC4337Service | null = null

export function getERC4337Service(config?: ERC4337Config): ERC4337Service {
  if (!serviceInstance) {
    serviceInstance = new ERC4337Service(config || defaultConfig)
  }
  return serviceInstance
}
