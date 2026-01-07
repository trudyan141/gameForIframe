import { API_ENDPOINTS } from '@/config/api';

export class BackendService {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL || "") {
    this.baseUrl = baseUrl;
  }

  async addDelegator(params: {
    userOp: any;
    entryPointAddress: string;
    sessionWalletAddress: string;
    accountAddress: string;
    delegatorAddress: string;
  }) {
    const response = await fetch(API_ENDPOINTS.addDelegator, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit delegation UserOp');
    }

    return result as {
      success: boolean;
      txHash: string;
      blockNumber: number;
    };
  }

  async buildStakingUserOp(params: {
    accountAddress: string;
    amount: string;
  }) {
    const response = await fetch(API_ENDPOINTS.buildStakingUserOp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to build staking UserOp');
    }

    return result as {
      userOp: any;
    };
  }

  async submitStakeUserOp(params: {
    userOp: any;
    entryPointAddress: string;
  }) {
    const response = await fetch(API_ENDPOINTS.stake, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit staking UserOp');
    }

    return result as {
      success: boolean;
      txHash: string;
      blockNumber: number;
    };
  }
  async buildLoginUserOp(params: {
    accountAddress: string;
    sessionAddress: string;
    expiryDuration: number;
  }) {
    const response = await fetch(API_ENDPOINTS.buildLoginUserOp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to build login UserOp');
    }

    return result as {
      userOp: import('./erc4337.service').UserOperation;
      userOpHash: string;
    };
  }

  async buildLogoutUserOp(params: {
    accountAddress: string;
    sessionAddress: string;
  }) {
    const response = await fetch(API_ENDPOINTS.buildLogoutUserOp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to build logout UserOp');
    }

    return result as {
      userOp: import('./erc4337.service').UserOperation;
      userOpHash: string;
    };
  }

  async revokeDelegator(params: {
    userOp: import('./erc4337.service').UserOperation;
    entryPointAddress: string;
  }) {
    const response = await fetch(API_ENDPOINTS.revokeDelegator, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to revoke delegator');
    }

    return result as {
      success: boolean;
      txHash: string;
      blockNumber: number;
      isRevoked: boolean;
    };
  }

  async buildUserOp(params: {
    senderAddress: string;
    callData: string;
  }) {
    const response = await fetch(API_ENDPOINTS.buildUserOp, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to build UserOp');
    }

    return result as {
      userOp: import('./erc4337.service').UserOperation;
      userOpHash: string;
    };
  }

  async submitUserOp(params: {
    userOp: any;
    entryPointAddress: string;
  }) {
    const response = await fetch(API_ENDPOINTS.stake, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit UserOp');
    }

    return result as {
      success: boolean;
      txHash: string;
      blockNumber: number;
    };
  }
}

export const defaultBackendService = new BackendService();
