// ============================================================================
// Shared System Constants & Default Configurations
// ============================================================================

export const APP_CONFIG = {
  appName: 'Secure Vault',
  shortName: 'Secure Vault',
  version: '1.0.0',
  defaultApiPort: 5000,
  defaultApiHost: '127.0.0.1',
  defaultWebPort: 5173,
  organization: 'Secure Vault',
  supportEmail: 'support@example.com',
  licenseDurationDays: 60, // 2-Month License Cycle
  offlineGracePeriodHours: 72,
} as const;

export const API_ENDPOINTS = {
  HEALTH: '/api/health',
  HEALTH_V1: '/api/v1/health',
  V1: {
    HEALTH: '/api/v1/health',
    AUTH: {
      LOGIN: '/api/v1/auth/login',
      REGISTER: '/api/v1/auth/register',
      LOGOUT: '/api/v1/auth/logout',
      REFRESH: '/api/v1/auth/refresh',
      FORGOT_PASSWORD: '/api/v1/auth/forgot-password',
      RESET_PASSWORD: '/api/v1/auth/reset-password',
      ME: '/api/v1/auth/me',
    },
    CREDENTIALS: '/api/v1/credentials',
    SHARED_CREDENTIALS: '/api/v1/credentials/shared',
    CREDENTIAL_SHARES: '/api/v1/credential-shares',
    PASSWORD_HEALTH: '/api/v1/password-health',
    SHARING: '/api/v1/credential-shares',
    NOTIFICATIONS: '/api/v1/notifications',
    AUDIT: '/api/v1/audit',
    LICENSE: '/api/v1/license',
    USERS: '/api/v1/users',
    ADMIN: {
      DASHBOARD: '/api/v1/admin/dashboard',
      REGISTRATIONS: '/api/v1/admin/registrations',
    },
  },
} as const;

export const SECURITY_LIMITS = {
  maxJsonBodySize: '1mb',
  rateLimitWindowMs: 15 * 60 * 1000, // 15 minutes
  rateLimitMaxRequests: 5000,
  authRateLimitMaxRequests: 100, // Brute-force protection on auth routes
  revealRateLimitMaxRequests: 60, // Limit on password reveal endpoint
} as const;

export const AUTH_CONFIG = {
  passwordMinLength: 8,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false, // Recommended / enforced where applicable
  },
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
  refreshTokenTtlSeconds: 7 * 24 * 60 * 60, // 7 days in seconds
  cookieNames: {
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
  },
  bootstrap: {
    defaultAdminEmail: 'admin@toptechdevelopers.com',
    defaultAdminPassword: 'Admin@12345',
    defaultAdminEmployeeId: 'ADM001',
    defaultAdminName: 'System Administrator',
    defaultEmployeeEmail: 'employee@toptechdevelopers.com',
    defaultEmployeePassword: 'Employee@12345',
    defaultEmployeeEmployeeId: 'EMP001',
    defaultEmployeeName: 'Sample Employee',
  },
} as const;

export const CREDENTIAL_CONFIG = {
  categories: [
    'DEVELOPMENT',
    'CLOUD',
    'DATABASE',
    'SERVER',
    'WEB_PORTAL',
    'API_KEY',
    'FINANCE',
    'SOCIAL',
    'EMAIL',
    'WORK',
    'PERSONAL',
    'OTHER',
  ] as const,
  maxNotesLength: 5000,
  maxTitleLength: 100,
  maxUsernameLength: 200,
  maxWebsiteLength: 500,
  defaultPage: 1,
  defaultPageLimit: 20,
  maxPageLimit: 100,
  passwordGenerator: {
    defaultLength: 16,
    minLength: 8,
    maxLength: 128,
  },
} as const;

export const SHARE_CONFIG = {
  resourceTypes: ['CREDENTIAL', 'FILE'] as const,
  shareMethods: ['PANEL', 'EMAIL'] as const,
  recipientTypes: ['REGISTERED', 'EXTERNAL'] as const,
  permissions: ['VIEW', 'VIEW_REVEAL'] as const,
  filePermissions: ['VIEW', 'DOWNLOAD', 'VIEW_DOWNLOAD'] as const,
  statuses: ['PENDING', 'ACTIVE', 'REJECTED', 'REVOKED', 'EXPIRED'] as const,
  deliveryStatuses: ['PENDING', 'SENT', 'FAILED'] as const,
  defaultExpirationDays: 7,
  maxExpirationDays: 90,
  minExpirationMinutes: 5,
  expirationPresets: [
    { label: '1 Hour', hours: 1 },
    { label: '24 Hours (1 Day)', hours: 24 },
    { label: '3 Days', hours: 24 * 3 },
    { label: '7 Days (1 Week)', hours: 24 * 7 },
    { label: '30 Days (1 Month)', hours: 24 * 30 },
  ] as const,
} as const;

export const FILE_SHARE_CONFIG = {
  maxFileSizeMB: 25,
  maxBatchSizeMB: 50,
  maxFilesCount: 10,
  storagePath: 'storage/shared-files',
  allowedExtensions: [
    'pdf',
    'doc',
    'docx',
    'xls',
    'xlsx',
    'ppt',
    'pptx',
    'txt',
    'csv',
    'jpg',
    'jpeg',
    'png',
    'zip',
  ] as const,
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/jpeg',
    'image/png',
    'application/zip',
    'application/x-zip-compressed',
  ] as const,
} as const;

export const EMAIL_SHARE_CONFIG = {
  otpLength: 6,
  otpTtlMinutes: 10,
  maxOtpAttempts: 5,
  tokenLengthBytes: 32,
  webBaseUrl: 'http://localhost:5173',
} as const;


export const PASSWORD_HEALTH_CONFIG = {
  oldAgeDays: 90,
  criticalAgeDays: 180,
  cacheTtlSeconds: 300, // 5 minutes in Redis
  statusThresholds: {
    healthyMin: 80,
    needsAttentionMin: 60,
    atRiskMin: 40,
  },
  scoringDeductions: {
    veryWeakStrength: 40,
    weakStrength: 25,
    mediumStrength: 10,
    policyViolation: 20,
    reusedPassword: 25,
    oldPassword: 15,
    criticalOldPassword: 30,
  },
} as const;

export const NOTIFICATION_CONFIG = {
  defaultPage: 1,
  defaultLimit: 20,
  maxLimit: 50,
  unreadCacheTtlSeconds: 60, // 1 minute Redis caching for unread count
  pollingIntervalMs: 30000, // 30s UI background polling interval
} as const;

export const AUDIT_CONFIG = {
  defaultPage: 1,
  defaultLimit: 25,
  maxLimit: 100,
  categories: [
    'AUTHENTICATION',
    'USER_MANAGEMENT',
    'CREDENTIAL',
    'PASSWORD_HEALTH',
    'SHARING',
    'NOTIFICATION',
    'SECURITY',
    'SYSTEM',
  ] as const,
  results: ['SUCCESS', 'FAILURE', 'DENIED'] as const,
  prohibitedMetadataKeys: [
    'password',
    'passwd',
    'secret',
    'token',
    'accesstoken',
    'refreshtoken',
    'encryptionkey',
    'encryptedpassword',
    'ciphertext',
    'iv',
    'authtag',
    'smtppassword',
    'mongodburi',
    'redispassword',
    'passwordhash',
    'credentialsecret',
  ] as const,
} as const;

export const LICENSE_CONFIG = {
  product: 'CredentialManager',
  version: 1,
  algorithm: 'Ed25519' as const,
  defaultDurationMonths: 2,
  offlineGraceDays: 3,
  expiryWarningDays: 7,
  clockToleranceMinutes: 5,
  trustedTimeEndpoints: [
    'https://cloudflare.com',
    'https://google.com',
    'https://api.github.com',
  ],
  licenseFileName: 'license.lic',
  stateFileName: 'license-state.json',
  publicKeyPem: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAFiFf+4qdWDOZ19zHMJpTnCXTgmN2ANIHdlX885eq9rE=
-----END PUBLIC KEY-----`,
} as const;

export const DEFAULT_SIGNED_LICENSE = {
  payload: {
    version: 1,
    licenseId: "LIC-20260917-33CDE2B5",
    product: "CredentialManager",
    issuedAt: "2026-09-17T10:26:01.718Z",
    expiresAt: "2026-11-17T23:59:59.999Z",
    customerId: "TOPTECH-COLLEGE-001",
    issuedTo: "Faculty & Administrative Staff",
    organization: "Top Tech College of Engineering",
    machineBinding: "*",
    features: {
      credentialManagement: true,
      sharing: true,
      auditLogging: true,
      passwordHealth: true,
      notifications: true,
    },
  },
  signature: "HuYyyEjzbBGH1bJRCRKz+CuSJadhEccopCgGSFtmyUtJDrX8xlX509G+aevSlYckKAf7w5TFt0bdH3vhM/HUAw==",
  algorithm: "Ed25519" as const,
};




