// Backend API configuration
export const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-one-rouge-53.vercel.app';

// API endpoints
export const API_ENDPOINTS = {
  // UserOp operations
  stake: `${BACKEND_API_URL}/api/userops/stake`,
} as const;
