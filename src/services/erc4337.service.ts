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
// SINGLETON INSTANCES
// ============================================

let serviceInstance: ERC4337Service | null = null

export function getERC4337Service(config?: ERC4337Config): ERC4337Service {
  if (!serviceInstance) {
    serviceInstance = new ERC4337Service(config || defaultConfig)
  }
  return serviceInstance
}
