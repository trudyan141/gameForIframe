// Backend API configuration
export const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stag-lobby-api.sunrisegaming-dao.com';

// API endpoints
export const API_ENDPOINTS = {
  // UserOp operations
  submit: `${BACKEND_API_URL}/api/userops/submit`,
} as const;
