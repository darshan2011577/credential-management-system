// ============================================================================
// Shared Domain & API Types for Credential Management System
// ============================================================================

export type UserRole = 'EMPLOYEE' | 'ADMIN';

export type CredentialCategory =
  | 'DEVELOPMENT'
  | 'CLOUD'
  | 'DATABASE'
  | 'SERVER'
  | 'WEB_PORTAL'
  | 'API_KEY'
  | 'FINANCE'
  | 'SOCIAL'
  | 'EMAIL'
  | 'WORK'
  | 'PERSONAL'
  | 'OTHER';

export type PasswordStrengthLevel =
  | 'VERY_WEAK'
  | 'WEAK'
  | 'MEDIUM'
  | 'STRONG'
  | 'VERY_STRONG';

export type LicenseStatus =
  | 'VALID'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'INVALID'
  | 'TAMPERED'
  | 'NOT_FOUND'
  | 'CLOCK_SUSPICIOUS'
  | 'OFFLINE_EXCEEDED';

export type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';

export type AuditCategory =
  | 'AUTHENTICATION'
  | 'USER_MANAGEMENT'
  | 'CREDENTIAL'
  | 'PASSWORD_HEALTH'
  | 'SHARING'
  | 'NOTIFICATION'
  | 'SECURITY'
  | 'SYSTEM';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'TOKEN_REFRESH'
  | 'PASSWORD_CHANGE'
  | 'CREDENTIAL_CREATED'
  | 'CREDENTIAL_UPDATED'
  | 'CREDENTIAL_DELETED'
  | 'CREDENTIAL_REVEALED'
  | 'CREDENTIAL_VIEWED'
  | 'CREDENTIAL_FAVORITED'
  | 'CREDENTIAL_UNFAVORITED'
  | 'SHARE_CREATED'
  | 'SHARE_APPROVED'
  | 'SHARE_REJECTED'
  | 'SHARE_REVOKED'
  | 'SHARED_CREDENTIAL_REVEALED'
  | 'SHARED_CREDENTIAL_VIEWED'
  | 'FILE_SHARE_CREATED'
  | 'CREDENTIAL_EMAIL_SHARE_CREATED'
  | 'FILE_EMAIL_SHARE_CREATED'
  | 'SHARE_ACCESSED'
  | 'SHARE_OTP_REQUESTED'
  | 'SHARE_OTP_VERIFIED'
  | 'FILE_DOWNLOADED'
  | 'FILE_DOWNLOAD_AUTHENTICATED'
  | 'EMAIL_SHARE_RESENT'
  | 'PASSWORD_HEALTH_VIEWED'
  | 'PASSWORD_HEALTH_ANALYZED'
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED'
  | 'USER_DELETED'
  | 'USER_PASSWORD_CHANGED'
  | 'SECURITY_ALERT'
  | 'SECURITY_NOTIFICATION_CREATED'
  | 'REGISTRATION_SUBMITTED'
  | 'REGISTRATION_APPROVED'
  | 'REGISTRATION_REJECTED'
  | 'CREDENTIALS_SENT'
  | 'CREDENTIALS_RESENT'
  | 'PASSWORD_CHANGE_REQUESTED'
  | 'FORGOT_PASSWORD_REQUESTED'
  | 'PASSWORD_CHANGE_APPROVED'
  | 'PASSWORD_CHANGE_REJECTED'
  | 'PASSWORD_RESET_APPROVED'
  | 'PASSWORD_RESET_REJECTED'
  | 'LOGIN_BLOCKED_PENDING'
  | 'LOGIN_BLOCKED_REJECTED'
  | 'LOGIN_BLOCKED_DISABLED'
  | 'LICENSE_VALIDATED'
  | 'LICENSE_IMPORTED'
  | 'LICENSE_RENEWED'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_VALIDATION_FAILED'
  | 'LICENSE_TAMPER_DETECTED';

export type AuditResult = 'SUCCESS' | 'FAILURE' | 'DENIED';

// ----------------------------------------------------------------------------
// API Standard Envelope Responses (Phase 3 Standard)
// ----------------------------------------------------------------------------

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'ROUTE_NOT_FOUND'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface ApiErrorDetail {
  code: ErrorCode | string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail | string;
  code?: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

export type DependencyStatus = 'connected' | 'disconnected' | 'connecting' | 'error' | 'pending';

export interface DatabaseHealthDetail {
  status: DependencyStatus;
  database?: string;
  pingMs?: number;
}

export interface RedisHealthDetail {
  status: DependencyStatus;
  pingMs?: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  service: string;
  version: string;
  uptime: number;
  environment: string;
  timestamp: string;
  system: {
    nodeVersion: string;
    platform: string;
    memoryUsageMB: number;
  };
  services: {
    api: 'ok';
    database: DependencyStatus;
    redis: DependencyStatus;
  };
  dependencies: {
    mongodb: DatabaseHealthDetail;
    redis: RedisHealthDetail;
  };
}

// ----------------------------------------------------------------------------
// User & Auth
// ----------------------------------------------------------------------------

export type UserStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'ACTIVE'
  | 'REJECTED'
  | 'DISABLED'
  | 'INACTIVE'
  | 'SUSPENDED';

export type CredentialDeliveryStatus = 'NOT_SENT' | 'SENDING' | 'SENT' | 'FAILED';

export interface IUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  phoneNumber?: string;
  credentialDeliveryStatus?: CredentialDeliveryStatus;
  credentialsSentAt?: string;
  registeredAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SafeUser = IUser;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  employeeId: string;
  role: UserRole;
  createdAt: string;
  expiresAt: string;
}

export interface JwtAccessPayload {
  sub: string;
  employeeId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponseData {
  user: SafeUser;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface CreateUserDto {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department?: string;
  phoneNumber?: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
  department?: string;
  phoneNumber?: string;
  role?: UserRole;
  status?: UserStatus;
  credentialDeliveryStatus?: CredentialDeliveryStatus;
}

export interface RegisterDto {
  name: string;
  email: string;
  phoneNumber?: string;
  department?: string;
  employeeId: string;
}

export interface RegistrationRejectDto {
  reason?: string;
}

export interface RegistrationListItem {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  phoneNumber?: string;
  department?: string;
  status: UserStatus;
  credentialDeliveryStatus: CredentialDeliveryStatus;
  credentialsSentAt?: string;
  registeredAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface RegistrationListQuery {
  status?: UserStatus;
  department?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RegistrationPaginationResult {
  registrations: RegistrationListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  pendingCount: number;
}


// ----------------------------------------------------------------------------
// Encryption & Credential Model (Phase 6)
// ----------------------------------------------------------------------------

export interface EncryptedData {
  version: number;
  algorithm: 'aes-256-gcm';
  iv: string; // Base64
  authTag: string; // Base64
  ciphertext: string; // Base64
}

export interface ICredential {
  id: string;
  ownerId: string;
  title: string;
  website?: string;
  username: string;
  category: CredentialCategory;
  notes?: string;
  favorite: boolean;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
  isShared?: boolean;
}

export type ICredentialListItem = ICredential;

export interface IDecryptedCredential extends ICredential {
  decryptedPassword?: string;
  decryptedNotes?: string;
}

export interface CreateCredentialDto {
  title: string;
  website?: string;
  username: string;
  password: string;
  category: CredentialCategory;
  notes?: string;
  favorite?: boolean;
}

export interface UpdateCredentialDto {
  title?: string;
  website?: string;
  username?: string;
  password?: string;
  category?: CredentialCategory;
  notes?: string;
  favorite?: boolean;
}

export interface RevealCredentialResponse {
  username: string;
  password: string;
}

export interface GeneratePasswordDto {
  length?: number;
  uppercase?: boolean;
  lowercase?: boolean;
  numbers?: boolean;
  symbols?: boolean;
}

export interface GeneratePasswordResponse {
  password: string;
}

export interface CredentialPaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: CredentialCategory;
  favorite?: boolean;
}

export interface CredentialPaginationResult {
  items: ICredentialListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ----------------------------------------------------------------------------
// Password Health (Phase 7)
// ----------------------------------------------------------------------------

export type PasswordHealthStatus =
  | 'HEALTHY'
  | 'NEEDS_ATTENTION'
  | 'AT_RISK'
  | 'CRITICAL';

export type PasswordAgeStatus = 'NORMAL' | 'OLD' | 'CRITICAL';

export type PasswordHealthIssueCode =
  | 'WEAK_PASSWORD'
  | 'VERY_WEAK_PASSWORD'
  | 'POLICY_VIOLATION'
  | 'PASSWORD_REUSED'
  | 'PASSWORD_TOO_OLD'
  | 'VERY_OLD_PASSWORD';

export interface PasswordHealthIssue {
  code: PasswordHealthIssueCode;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface PasswordHealthResult {
  credentialId: string;
  title: string;
  category: CredentialCategory;
  username: string;
  website?: string;
  strength: PasswordStrengthLevel;
  strengthScore: number; // 0-100
  policyCompliant: boolean;
  reused: boolean;
  reuseCount: number;
  passwordAgeDays: number;
  ageStatus: PasswordAgeStatus;
  score: number; // 0-100 individual health score
  issues: PasswordHealthIssue[];
  recommendations: string[];
  analyzedAt: string;
}

export interface PasswordReuseGroup {
  count: number;
  credentialIds: string[];
}

export interface PasswordHealthSummary {
  score: number; // 0-100 overall employee score
  status: PasswordHealthStatus;
  totalCredentials: number;
  healthyCredentials: number;
  weakCredentials: number;
  reusedCredentials: number;
  oldCredentials: number;
  policyViolations: number;
  reuseGroups?: PasswordReuseGroup[];
  generatedAt: string;
}

export interface PasswordHealthDetailsResponse {
  summary: PasswordHealthSummary;
  items: PasswordHealthResult[];
}

export interface IPasswordHealth {
  score: number; // 0-100
  strength: PasswordStrengthLevel;
  length: number;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumbers: boolean;
  hasSpecialChars: boolean;
  isReused: boolean;
  ageDays: number;
  issues: string[];
}

export interface IPasswordHealthDashboard {
  totalCredentials: number;
  strongCount: number;
  mediumCount: number;
  weakCount: number;
  reusedCount: number;
  overallScore: number;
}

// ----------------------------------------------------------------------------
// Sharing & Access Control (Phase 8 & Phase 14: Secure File & Email Sharing)
// ----------------------------------------------------------------------------

export type SharePermission = 'VIEW' | 'VIEW_REVEAL';
export type FileSharePermission = 'VIEW' | 'DOWNLOAD' | 'VIEW_DOWNLOAD';
export type UnifiedSharePermission = SharePermission | FileSharePermission;

export type ShareResourceType = 'CREDENTIAL' | 'FILE';
export type ShareMethod = 'PANEL' | 'EMAIL';
export type RecipientType = 'REGISTERED' | 'EXTERNAL';
export type ShareDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export type ShareStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'EXPIRED';

export interface IFileMetadata {
  originalName: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  isCompressed?: boolean;
  fileCount?: number;
  filesList?: Array<{
    originalName: string;
    sizeBytes: number;
    mimeType: string;
  }>;
}

export interface ShareRecipientOption {
  id: string;
  name: string;
  email: string;
  employeeId: string;
  department?: string;
  role: UserRole;
}

export interface ICredentialShare {
  id: string;
  resourceType: ShareResourceType;
  shareMethod: ShareMethod;
  recipientType: RecipientType;
  credentialId?: string;
  ownerId: string;
  recipientId?: string;
  recipientEmail?: string;
  fileMetadata?: IFileMetadata;
  permission: UnifiedSharePermission;
  status: ShareStatus;
  deliveryStatus?: ShareDeliveryStatus;
  downloadCount?: number;
  maxDownloads?: number;
  expiresAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  revokedAt?: string;
  createdAt: string;
  updatedAt: string;
  shareUrl?: string;
  // Populated metadata for UI display
  credential?: {
    id: string;
    title: string;
    username: string;
    category: CredentialCategory;
    website?: string;
    notes?: string;
  };
  owner?: {
    id: string;
    name: string;
    email: string;
    employeeId: string;
    department?: string;
  };
  recipient?: {
    id: string;
    name: string;
    email: string;
    employeeId: string;
    department?: string;
  };
}

export interface CreateShareDto {
  resourceType?: ShareResourceType;
  shareMethod?: ShareMethod;
  credentialId?: string;
  linkedCredentialId?: string;
  recipientId?: string;
  recipientEmail?: string;
  permission: UnifiedSharePermission;
  expiresAt: string;
  compress?: boolean;
  maxDownloads?: number;
}

export interface SharedCredentialItem {
  shareId: string;
  credentialId: string;
  title: string;
  website?: string;
  username: string;
  category: CredentialCategory;
  notes?: string;
  permission: UnifiedSharePermission;
  owner: {
    id: string;
    name: string;
    email: string;
    employeeId: string;
    department?: string;
  };
  expiresAt: string;
  status: ShareStatus;
  sharedAt: string;
}

export interface SharedFileItem {
  shareId: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  isCompressed?: boolean;
  fileCount?: number;
  permission: UnifiedSharePermission;
  downloadCount: number;
  maxDownloads?: number;
  isCredentialProtected?: boolean;
  linkedCredentialId?: string;
  linkedCredentialTitle?: string;
  owner: {
    id: string;
    name: string;
    email: string;
    employeeId: string;
    department?: string;
  };
  expiresAt: string;
  status: ShareStatus;
  sharedAt: string;
}

export interface SharedRevealResponse {
  credentialId: string;
  username: string;
  password: string;
}

export interface PublicShareMetadata {
  shareId: string;
  resourceType: ShareResourceType;
  senderName: string;
  recipientEmailMasked: string;
  expiresAt: string;
  permission: UnifiedSharePermission;
  isExpired: boolean;
  isRevoked: boolean;
  requiresOtp: boolean;
  isOtpVerified?: boolean;
  itemSummary: {
    title?: string;
    category?: string;
    website?: string;
    fileName?: string;
    fileSizeBytes?: number;
    mimeType?: string;
    isCompressed?: boolean;
    fileCount?: number;
    maxDownloads?: number;
    remainingDownloads?: number;
    isCredentialProtected?: boolean;
    linkedCredentialTitle?: string;
  };
}

export interface RequestShareOtpDto {
  email: string;
}

export interface VerifyShareOtpDto {
  email: string;
  otp: string;
}

export interface PublicShareAccessData {
  ticket: string;
  resourceType: ShareResourceType;
  permission: UnifiedSharePermission;
  expiresAt: string;
  credential?: {
    title: string;
    category: CredentialCategory;
    website?: string;
    username: string;
    password?: string;
    notes?: string;
  };
  file?: {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    isCompressed?: boolean;
    canDownload: boolean;
    remainingDownloads?: number;
    isCredentialProtected?: boolean;
    linkedCredentialTitle?: string;
  };
}

export interface IAccessRequest {
  id: string;
  credentialId: string;
  credentialName: string;
  requesterId: string;
  requesterName: string;
  reason: string;
  status: AccessRequestStatus;
  startDate?: string;
  expiryDate?: string;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ----------------------------------------------------------------------------
// Audit Logs (Phase 10)
// ----------------------------------------------------------------------------

export interface IAuditLog {
  id: string;
  actorId?: string;
  actorRole: UserRole | 'SYSTEM';
  actorEmail?: string;
  actorName?: string;
  action: AuditAction;
  category: AuditCategory;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: string;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type IAuditLogListItem = IAuditLog;

export interface AuditLogPaginationResult {
  items: IAuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  category?: AuditCategory;
  action?: AuditAction;
  result?: AuditResult;
  actorId?: string;
  targetUserId?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
  search?: string;
}

export interface CreateAuditLogDto {
  actorId?: string;
  actorRole?: UserRole | 'SYSTEM';
  actorEmail?: string;
  actorName?: string;
  action: AuditAction;
  category: AuditCategory;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: string;
  result?: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// In-App Notifications & Email Events (Phase 9)
// ----------------------------------------------------------------------------

export type NotificationType =
  | 'SHARE_REQUEST_RECEIVED'
  | 'SHARE_REQUEST_APPROVED'
  | 'SHARE_REQUEST_REJECTED'
  | 'SHARE_REVOKED'
  | 'SHARED_CREDENTIAL_REVEALED'
  | 'SECURITY_ALERT'
  | 'REGISTRATION_PENDING'
  | 'REGISTRATION_APPROVED'
  | 'CREDENTIALS_DELIVERED';

export type NotificationRelatedEntityType =
  | 'CredentialShare'
  | 'Credential'
  | 'User'
  | 'Security';

export interface INotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: NotificationRelatedEntityType;
  relatedEntityId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type INotificationListItem = INotification;

export interface NotificationPaginationResult {
  items: INotification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkNotificationReadResponse {
  id: string;
  isRead: boolean;
  readAt?: string;
}

export interface MarkAllNotificationsReadResponse {
  modifiedCount: number;
}

export interface NotificationQuery {
  page?: number;
  limit?: number;
}

export interface CreateNotificationDto {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: NotificationRelatedEntityType;
  relatedEntityId?: string;
}

// ----------------------------------------------------------------------------
// 2-Month Signed License (Phase 11)
// ----------------------------------------------------------------------------

export interface ILicenseFeatures {
  credentialManagement?: boolean;
  sharing?: boolean;
  auditLogging?: boolean;
  passwordHealth?: boolean;
  notifications?: boolean;
  [key: string]: boolean | undefined;
}

export interface ILicensePayload {
  version: number;
  licenseId: string;
  product: string;
  issuedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
  customerId: string;
  issuedTo?: string;
  organization?: string;
  machineBinding?: string; // SHA-256 hash or '*'
  features?: ILicenseFeatures;
}

export interface ISignedLicense {
  payload: ILicensePayload;
  signature: string; // Base64
  algorithm: 'Ed25519';
}

export interface ILicenseValidationResult {
  isValid: boolean;
  status: LicenseStatus;
  licenseId?: string;
  issuedAt?: string;
  expiresAt?: string;
  daysRemaining?: number;
  customerId?: string;
  organization?: string;
  issuedTo?: string;
  features?: ILicenseFeatures;
  machineBound?: boolean;
  reason?: string;
  warning?: string;
  lastTrustedTime?: string;
  validatedAt: string;
}

export type ILicenseStatusResponse = ILicenseValidationResult;

export interface ImportLicenseDto {
  licenseData: string;
}

export interface LocalLicenseState {
  lastTrustedTime: string; // ISO 8601
  lastSuccessfulValidation: string; // ISO 8601
  lastLocalTime: string; // ISO 8601
}

// ----------------------------------------------------------------------------
// Phase 12: Admin Dashboard Types
// ----------------------------------------------------------------------------

export type AdminDashboardDateRange =
  | 'TODAY'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'ALL_TIME';

export interface AdminDashboardQuery {
  dateRange?: AdminDashboardDateRange;
  employeeId?: string;
  from?: string;
  to?: string;
}

export interface AdminDashboardEmployeeStats {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  recentlyCreated: number;
}

export interface AdminDashboardCredentialStats {
  total: number;
  active: number;
  favorite: number;
  byCategory: Record<CredentialCategory, number>;
  recentlyCreated: number;
}

export interface AdminDashboardPasswordHealthStats {
  totalAnalyzed: number;
  healthy: number;
  needsAttention: number;
  atRisk: number;
  critical: number;
  weakCount: number;
  reusedCount: number;
  oldPasswordCount: number;
  policyViolations: number;
  averageScore: number;
}

export interface AdminDashboardSharingActivityItem {
  id: string;
  credentialTitle: string;
  ownerName: string;
  recipientName: string;
  permission: SharePermission;
  status: ShareStatus;
  createdAt: string;
}

export interface AdminDashboardSharingStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  revoked: number;
  expired: number;
  recentShares: AdminDashboardSharingActivityItem[];
}

export interface AdminDashboardAuditEventTimelineItem {
  date: string;
  count: number;
  successCount: number;
  failureCount: number;
}

export interface AdminDashboardAuditStats {
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  eventTimeline: AdminDashboardAuditEventTimelineItem[];
}

export interface AdminDashboardRecentActivityItem {
  id: string;
  action: AuditAction;
  actionDescription: string;
  category: AuditCategory;
  actorName: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM';
  targetUserName?: string;
  result: AuditResult;
  timestamp: string;
}

export interface AdminDashboardEmployeeOverviewItem {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  role: UserRole;
  status: UserStatus;
  credentialCount: number;
  healthStatus: PasswordHealthStatus;
  healthScore: number;
  lastActiveAt?: string;
  createdAt: string;
}

export interface AdminDashboardData {
  dateRange: AdminDashboardDateRange;
  calculatedFrom?: string;
  calculatedTo?: string;
  employees: AdminDashboardEmployeeStats;
  credentials: AdminDashboardCredentialStats;
  passwordHealth: AdminDashboardPasswordHealthStats;
  sharing: AdminDashboardSharingStats;
  audit: AdminDashboardAuditStats;
  license: ILicenseValidationResult;
  recentActivity: AdminDashboardRecentActivityItem[];
  employeeOverview: AdminDashboardEmployeeOverviewItem[];
  generatedAt: string;
}


// ----------------------------------------------------------------------------
// Electron Preload Bridge API Contract (Phase 2 Desktop Integration)
// ----------------------------------------------------------------------------

export interface DesktopAppInfo {
  appName: string;
  version: string;
  platform: string;
  architecture: string;
  electronVersion: string;
  nodeVersion: string;
  isPackaged: boolean;
  chromeVersion: string;
}

export interface DesktopApiStatus {
  isRunning: boolean;
  port: number;
  host: string;
  apiUrl: string;
  uptimeSeconds: number;
  restartCount: number;
}

export interface DesktopBridge {
  getAppInfo: () => Promise<DesktopAppInfo>;
  getApiStatus: () => Promise<DesktopApiStatus>;
  restartApi: () => Promise<{ success: boolean; message: string }>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  isMaximized: () => Promise<boolean>;
  onApiCrashed: (callback: (error: string) => void) => () => void;
  ping: () => Promise<string>;
  // Phase 11 License Bridge APIs
  getLicenseStatus: () => Promise<ILicenseStatusResponse>;
  importLicense: (licenseData: string) => Promise<{ success: boolean; status: ILicenseStatusResponse; message: string }>;
  selectLicenseFile: () => Promise<{ canceled: boolean; filePath?: string; content?: string }>;
  getMachineId: () => Promise<string>;
}

export interface ElectronAPIBridge {
  getAppVersion: () => Promise<string>;
  getPlatform: () => string;
  isPackaged: () => boolean;
  ping: () => Promise<string>;
}

// ----------------------------------------------------------------------------
// Password Request & Approval Workflow Types
// ----------------------------------------------------------------------------

export type PasswordRequestType = 'PASSWORD_CHANGE' | 'FORGOT_PASSWORD';
export type PasswordRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PasswordRequestListItem {
  id: string;
  userId: string;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  requestType: PasswordRequestType;
  status: PasswordRequestStatus;
  reason?: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  adminNote?: string;
}

export interface SubmitPasswordChangeRequestDto {
  currentPassword: string;
  newPassword: string;
  reason?: string;
}

export interface SubmitForgotPasswordRequestDto {
  emailOrEmployeeId: string;
  newPassword: string;
  reason?: string;
}

export interface PasswordRequestOverviewResponse {
  requests: PasswordRequestListItem[];
  total: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
    electronAPI?: ElectronAPIBridge;
  }
}


