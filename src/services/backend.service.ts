import { API_ENDPOINTS } from '@/config/api';

export class BackendService {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_BACKEND_URL || "") {
    this.baseUrl = baseUrl;
  }



  async submitUserOp(params: {
    userOp: any;
    entryPointAddress: string;
  }) {
    const response = await fetch(API_ENDPOINTS.submit, {
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
