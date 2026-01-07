// Backend API configuration
export const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://backend-one-rouge-53.vercel.app';

// API endpoints
export const API_ENDPOINTS = {
  // Account management
  createAccount: `${BACKEND_API_URL}/api/accounts/create`,
  getAccountAddress: `${BACKEND_API_URL}/api/accounts/address`,
  listAccounts: `${BACKEND_API_URL}/api/accounts/list`,
  accountDetails: `${BACKEND_API_URL}/api/accounts/details`,
  allAccounts: `${BACKEND_API_URL}/api/accounts/all`,
  accountStats: `${BACKEND_API_URL}/api/accounts/stats`,
  
  // UserOp operations
  addDelegator: `${BACKEND_API_URL}/api/userops/add-delegator`,
  revokeDelegator: `${BACKEND_API_URL}/api/userops/revoke-delegator`,
  stake: `${BACKEND_API_URL}/api/userops/stake`,
  transfer: `${BACKEND_API_URL}/api/userops/transfer`,

  // UserOp builders
  buildLoginUserOp: `${BACKEND_API_URL}/api/userop-builder/login`,
  buildStakingUserOp: `${BACKEND_API_URL}/api/userop-builder/staking`,
  buildLogoutUserOp: `${BACKEND_API_URL}/api/userop-builder/logout`,
  buildUserOp: `${BACKEND_API_URL}/api/userop-builder/build`,
} as const;
