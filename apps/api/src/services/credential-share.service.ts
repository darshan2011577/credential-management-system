import crypto from 'crypto';
import mongoose, { Types } from 'mongoose';
import {
  CreateShareDto,
  ICredentialShare,
  PublicShareAccessData,
  PublicShareMetadata,
  SharedCredentialItem,
  SharedFileItem,
  SharedRevealResponse,
  ShareRecipientOption,
} from '@credential-manager/types';
import { EMAIL_SHARE_CONFIG, SHARE_CONFIG } from '@credential-manager/config';
import { logger } from '@credential-manager/shared';
import { CredentialShareModel, ICredentialShareDocument } from '../models/credential-share.model.js';
import { CredentialModel } from '../models/credential.model.js';
import { UserModel } from '../models/user.model.js';
import { FileStorageService } from './file-storage.service.js';
import { EncryptionService } from './encryption.service.js';
import { NotificationService } from './notification.service.js';
import { EmailService } from './email/email.service.js';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

export class CredentialShareService {
  /**
   * Generates a 64-char cryptographically secure token and its SHA-256 hash.
   */
  private static generateShareToken(): { rawToken: string; tokenHash: string } {
    const rawToken = crypto.randomBytes(EMAIL_SHARE_CONFIG.tokenLengthBytes || 32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return { rawToken, tokenHash };
  }

  /**
   * Hashes an arbitrary string (token or OTP) with SHA-256.
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Creates a new share (Panel Share or Email Share for Credential or File).
   */
  public static async createShare(
    ownerId: string,
    dto: CreateShareDto,
    files?: Express.Multer.File[]
  ): Promise<ICredentialShare> {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw AppError.badRequest('Invalid owner identifier format.');
    }

    const resourceType = dto.resourceType || (files && files.length > 0 ? 'FILE' : 'CREDENTIAL');
    const shareMethod = dto.shareMethod || 'PANEL';
    const expiresAt = new Date(dto.expiresAt);

    if (isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw AppError.badRequest('Expiration date must be a valid future timestamp.');
    }

    const owner = await UserModel.findById(ownerId);
    if (!owner) {
      throw AppError.notFound('Owner account not found.');
    }

    // =========================================================================
    // 1. CREDENTIAL SHARING
    // =========================================================================
    if (resourceType === 'CREDENTIAL') {
      if (!dto.credentialId || !mongoose.Types.ObjectId.isValid(dto.credentialId)) {
        throw AppError.badRequest('Valid credential ID is required for credential sharing.');
      }

      // Verify original credential ownership
      const credential = await CredentialModel.findOne({
        _id: new mongoose.Types.ObjectId(dto.credentialId),
        ownerId: new mongoose.Types.ObjectId(ownerId),
      });

      if (!credential) {
        const existsElsewhere = await CredentialModel.exists({
          _id: new mongoose.Types.ObjectId(dto.credentialId),
        });
        if (existsElsewhere) {
          throw AppError.forbidden('Access denied. You can only share credentials that you own.');
        }
        throw AppError.notFound('Credential not found.');
      }

      // --- 1A. PANEL CREDENTIAL SHARE ---
      if (shareMethod === 'PANEL') {
        if (!dto.recipientId || !mongoose.Types.ObjectId.isValid(dto.recipientId)) {
          throw AppError.badRequest('Recipient employee ID is required for Panel Share.');
        }

        if (ownerId === dto.recipientId) {
          throw AppError.badRequest('You cannot share a credential with yourself.');
        }

        const recipient = await UserModel.findOne({
          _id: new mongoose.Types.ObjectId(dto.recipientId),
          status: 'ACTIVE',
        });

        if (!recipient) {
          throw AppError.notFound('Recipient employee was not found or is currently inactive.');
        }

        // Check for duplicate active or pending share
        const existingShare = await CredentialShareModel.findOne({
          credentialId: new mongoose.Types.ObjectId(dto.credentialId),
          recipientId: new mongoose.Types.ObjectId(dto.recipientId),
          resourceType: 'CREDENTIAL',
          status: { $in: ['PENDING', 'ACTIVE'] },
          expiresAt: { $gt: new Date() },
        });

        if (existingShare) {
          throw AppError.conflict(
            `An active or pending share request already exists for employee "${recipient.name}".`
          );
        }

        const share = await CredentialShareModel.create({
          resourceType: 'CREDENTIAL',
          shareMethod: 'PANEL',
          recipientType: 'REGISTERED',
          credentialId: new mongoose.Types.ObjectId(dto.credentialId),
          ownerId: new mongoose.Types.ObjectId(ownerId),
          recipientId: new mongoose.Types.ObjectId(dto.recipientId),
          recipientEmail: recipient.email,
          permission: dto.permission,
          status: 'PENDING',
          deliveryStatus: 'PENDING',
          expiresAt,
        });

        await share.populate([
          { path: 'credentialId', select: 'title username category website notes' },
          { path: 'ownerId', select: 'name email employeeId department' },
          { path: 'recipientId', select: 'name email employeeId department' },
        ]);

        await this.onShareCreated(share);
        return share.toSafeShare();
      }

      // --- 1B. EMAIL CREDENTIAL SHARE ---
      if (shareMethod === 'EMAIL') {
        if (!dto.recipientEmail || !dto.recipientEmail.includes('@')) {
          throw AppError.badRequest('A valid recipient email address is required for Email Share.');
        }

        const normalizedEmail = dto.recipientEmail.trim().toLowerCase();
        if (owner.email.toLowerCase() === normalizedEmail) {
          throw AppError.badRequest('You cannot share a credential with your own email address.');
        }

        // Check if recipient is a registered employee
        const registeredUser = await UserModel.findOne({
          email: normalizedEmail,
          status: 'ACTIVE',
        });

        const recipientType = registeredUser ? 'REGISTERED' : 'EXTERNAL';
        const { rawToken, tokenHash } = this.generateShareToken();
        const webBaseUrl = process.env.WEB_BASE_URL || EMAIL_SHARE_CONFIG.webBaseUrl;
        const shareUrl = `${webBaseUrl}/access-share/${rawToken}`;

        const share = await CredentialShareModel.create({
          resourceType: 'CREDENTIAL',
          shareMethod: 'EMAIL',
          recipientType,
          credentialId: new mongoose.Types.ObjectId(dto.credentialId),
          ownerId: new mongoose.Types.ObjectId(ownerId),
          recipientId: registeredUser ? registeredUser._id : undefined,
          recipientEmail: normalizedEmail,
          permission: dto.permission,
          status: 'ACTIVE', // Email shares are directly accessible via token
          deliveryStatus: 'PENDING',
          shareTokenHash: tokenHash,
          expiresAt,
        });

        await share.populate([
          { path: 'credentialId', select: 'title username category website notes' },
          { path: 'ownerId', select: 'name email employeeId department' },
          { path: 'recipientId', select: 'name email employeeId department' },
        ]);

        // Dispatch Email
        let deliveryStatus: 'SENT' | 'FAILED' = 'SENT';
        try {
          const emailRes = await EmailService.sendCredentialEmailShare({
            recipientEmail: normalizedEmail,
            senderName: owner.name,
            senderEmail: owner.email,
            credentialTitle: credential.title,
            credentialCategory: credential.category,
            permission: dto.permission,
            expiresAt: expiresAt.toISOString(),
            shareUrl,
          });
          if (!emailRes.success) deliveryStatus = 'FAILED';
        } catch (emailErr) {
          ApiLogger.warn('CredentialShareService', `Failed to send credential share email: ${emailErr}`);
          deliveryStatus = 'FAILED';
        }

        share.deliveryStatus = deliveryStatus;
        await share.save();

        // If registered user, notify in-app as well
        if (registeredUser) {
          try {
            await NotificationService.createNotification({
              recipientId: registeredUser._id.toString(),
              type: 'SHARE_REQUEST_RECEIVED',
              title: 'Secure Credential Share Link Received',
              message: `${owner.name} sent you a secure access link for credential "${credential.title}".`,
              relatedEntityType: 'CredentialShare',
              relatedEntityId: share._id.toString(),
            });
          } catch (_) {}
        }

        const safeShare = share.toSafeShare();
        safeShare.shareUrl = shareUrl;
        return safeShare;
      }
    }

    // =========================================================================
    // 2. FILE SHARING
    // =========================================================================
    if (resourceType === 'FILE') {
      if (!files || files.length === 0) {
        throw AppError.badRequest('At least one file must be uploaded for file sharing.');
      }

      // Store files and generate archive if needed
      const fileMetadata = await FileStorageService.processAndStoreFiles(files, dto.compress === true);

      // Verify and resolve optional linked protection credential
      let linkedCredentialObjectId: mongoose.Types.ObjectId | undefined;
      const requestedCredId = dto.linkedCredentialId || dto.credentialId;
      if (requestedCredId && mongoose.Types.ObjectId.isValid(requestedCredId)) {
        const cred = await CredentialModel.findOne({
          _id: new mongoose.Types.ObjectId(requestedCredId),
          ownerId: new mongoose.Types.ObjectId(ownerId),
        });
        if (!cred) {
          throw AppError.notFound('The specified credential to link for protection was not found.');
        }
        linkedCredentialObjectId = cred._id;
      }

      // --- 2A. PANEL FILE SHARE ---
      if (shareMethod === 'PANEL') {
        if (!dto.recipientId || !mongoose.Types.ObjectId.isValid(dto.recipientId)) {
          throw AppError.badRequest('Recipient employee ID is required for Panel File Share.');
        }

        if (ownerId === dto.recipientId) {
          throw AppError.badRequest('You cannot share a file with yourself.');
        }

        const recipient = await UserModel.findOne({
          _id: new mongoose.Types.ObjectId(dto.recipientId),
          status: 'ACTIVE',
        });

        if (!recipient) {
          throw AppError.notFound('Recipient employee was not found or is currently inactive.');
        }

        const share = await CredentialShareModel.create({
          resourceType: 'FILE',
          shareMethod: 'PANEL',
          recipientType: 'REGISTERED',
          credentialId: linkedCredentialObjectId,
          ownerId: new mongoose.Types.ObjectId(ownerId),
          recipientId: new mongoose.Types.ObjectId(dto.recipientId),
          recipientEmail: recipient.email,
          fileMetadata,
          permission: dto.permission || 'VIEW_DOWNLOAD',
          status: 'PENDING',
          deliveryStatus: 'PENDING',
          maxDownloads: dto.maxDownloads ? Math.max(1, Number(dto.maxDownloads)) : undefined,
          downloadCount: 0,
          expiresAt,
        });

        await share.populate([
          { path: 'ownerId', select: 'name email employeeId department' },
          { path: 'recipientId', select: 'name email employeeId department' },
          { path: 'credentialId', select: 'title category website' },
        ]);

        await this.onFileShareCreated(share);
        return share.toSafeShare();
      }

      // --- 2B. EMAIL FILE SHARE ---
      if (shareMethod === 'EMAIL') {
        if (!dto.recipientEmail || !dto.recipientEmail.includes('@')) {
          throw AppError.badRequest('A valid recipient email address is required for Email File Share.');
        }

        const normalizedEmail = dto.recipientEmail.trim().toLowerCase();
        if (owner.email.toLowerCase() === normalizedEmail) {
          throw AppError.badRequest('You cannot share a file with your own email address.');
        }

        const registeredUser = await UserModel.findOne({
          email: normalizedEmail,
          status: 'ACTIVE',
        });

        const recipientType = registeredUser ? 'REGISTERED' : 'EXTERNAL';
        const { rawToken, tokenHash } = this.generateShareToken();
        const webBaseUrl = process.env.WEB_BASE_URL || EMAIL_SHARE_CONFIG.webBaseUrl;
        const shareUrl = `${webBaseUrl}/access-share/${rawToken}`;

        const share = await CredentialShareModel.create({
          resourceType: 'FILE',
          shareMethod: 'EMAIL',
          recipientType,
          credentialId: linkedCredentialObjectId,
          ownerId: new mongoose.Types.ObjectId(ownerId),
          recipientId: registeredUser ? registeredUser._id : undefined,
          recipientEmail: normalizedEmail,
          fileMetadata,
          permission: dto.permission || 'VIEW_DOWNLOAD',
          status: 'ACTIVE',
          deliveryStatus: 'PENDING',
          shareTokenHash: tokenHash,
          maxDownloads: dto.maxDownloads ? Math.max(1, Number(dto.maxDownloads)) : undefined,
          downloadCount: 0,
          expiresAt,
        });

        await share.populate([
          { path: 'ownerId', select: 'name email employeeId department' },
          { path: 'recipientId', select: 'name email employeeId department' },
          { path: 'credentialId', select: 'title category website' },
        ]);

        let deliveryStatus: 'SENT' | 'FAILED' = 'SENT';
        try {
          const emailRes = await EmailService.sendFileEmailShare({
            recipientEmail: normalizedEmail,
            senderName: owner.name,
            senderEmail: owner.email,
            fileName: fileMetadata.originalName,
            fileSizeBytes: fileMetadata.sizeBytes,
            isCompressed: fileMetadata.isCompressed,
            fileCount: fileMetadata.fileCount,
            permission: dto.permission || 'VIEW_DOWNLOAD',
            expiresAt: expiresAt.toISOString(),
            shareUrl,
          });
          if (!emailRes.success) deliveryStatus = 'FAILED';
        } catch (emailErr) {
          ApiLogger.warn('CredentialShareService', `Failed to send file share email: ${emailErr}`);
          deliveryStatus = 'FAILED';
        }

        share.deliveryStatus = deliveryStatus;
        await share.save();

        if (registeredUser) {
          try {
            await NotificationService.createNotification({
              recipientId: registeredUser._id.toString(),
              type: 'SHARE_REQUEST_RECEIVED',
              title: 'Secure File Share Received',
              message: `${owner.name} shared file package "${fileMetadata.originalName}" with you.`,
              relatedEntityType: 'CredentialShare',
              relatedEntityId: share._id.toString(),
            });
          } catch (_) {}
        }

        const safeShare = share.toSafeShare();
        safeShare.shareUrl = shareUrl;
        return safeShare;
      }
    }

    throw AppError.badRequest('Unsupported share configuration.');
  }

  /**
   * Retrieves incoming share requests (panel shares) for the authenticated recipient.
   */
  public static async listIncomingShares(recipientId: string): Promise<ICredentialShare[]> {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const shares = await CredentialShareModel.find({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      recipientType: 'REGISTERED',
      shareMethod: 'PANEL',
    })
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .populate('recipientId', 'name email employeeId department')
      .sort({ createdAt: -1 })
      .exec();

    const now = new Date();
    return Promise.all(
      shares.map(async (share) => {
        if (share.status === 'ACTIVE' && share.expiresAt <= now) {
          share.status = 'EXPIRED';
          await share.save();
        }
        return share.toSafeShare();
      })
    );
  }

  /**
   * Retrieves outgoing panel shares created by the authenticated owner.
   */
  public static async listOutgoingShares(ownerId: string): Promise<ICredentialShare[]> {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const shares = await CredentialShareModel.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      shareMethod: 'PANEL',
    })
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .populate('recipientId', 'name email employeeId department')
      .sort({ createdAt: -1 })
      .exec();

    const now = new Date();
    return Promise.all(
      shares.map(async (share) => {
        if (share.status === 'ACTIVE' && share.expiresAt <= now) {
          share.status = 'EXPIRED';
          await share.save();
        }
        return share.toSafeShare();
      })
    );
  }

  /**
   * Retrieves outgoing email shares created by the authenticated owner.
   */
  public static async listEmailShares(ownerId: string): Promise<ICredentialShare[]> {
    if (!mongoose.Types.ObjectId.isValid(ownerId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const shares = await CredentialShareModel.find({
      ownerId: new mongoose.Types.ObjectId(ownerId),
      shareMethod: 'EMAIL',
    })
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .populate('recipientId', 'name email employeeId department')
      .sort({ createdAt: -1 })
      .exec();

    const now = new Date();
    return Promise.all(
      shares.map(async (share) => {
        if (share.status === 'ACTIVE' && share.expiresAt <= now) {
          share.status = 'EXPIRED';
          await share.save();
        }
        return share.toSafeShare();
      })
    );
  }

  /**
   * Recipient approves a pending share request.
   */
  public static async approveShare(recipientId: string, shareId: string): Promise<ICredentialShare> {
    if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(shareId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findById(shareId)
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .populate('recipientId', 'name email employeeId department');

    if (!share) {
      throw AppError.notFound('Share request not found.');
    }

    const shareRecipientId = (share.recipientId as any)?._id
      ? (share.recipientId as any)._id.toString()
      : share.recipientId?.toString();

    if (shareRecipientId !== recipientId) {
      throw AppError.forbidden('Access denied. You are not authorized to approve this share request.');
    }

    if (share.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot approve share request with status "${share.status}".`);
    }

    if (share.expiresAt <= new Date()) {
      share.status = 'EXPIRED';
      await share.save();
      throw AppError.badRequest('This share request has already expired.');
    }

    share.status = 'ACTIVE';
    share.approvedAt = new Date();
    await share.save();

    await this.onShareApproved(share);
    return share.toSafeShare();
  }

  /**
   * Recipient rejects a pending share request.
   */
  public static async rejectShare(recipientId: string, shareId: string): Promise<ICredentialShare> {
    if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(shareId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findById(shareId)
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .populate('recipientId', 'name email employeeId department');

    if (!share) {
      throw AppError.notFound('Share request not found.');
    }

    const shareRecipientId = (share.recipientId as any)?._id
      ? (share.recipientId as any)._id.toString()
      : share.recipientId?.toString();

    if (shareRecipientId !== recipientId) {
      throw AppError.forbidden('Access denied. You are not authorized to reject this share request.');
    }

    if (share.status !== 'PENDING') {
      throw AppError.badRequest(`Cannot reject share request with status "${share.status}".`);
    }

    share.status = 'REJECTED';
    share.rejectedAt = new Date();
    await share.save();

    await this.onShareRejected(share);
    return share.toSafeShare();
  }

  /**
   * Owner revokes an active or pending share (Panel or Email).
   */
  public static async revokeShare(ownerId: string, shareId: string): Promise<ICredentialShare> {
    if (!mongoose.Types.ObjectId.isValid(ownerId) || !mongoose.Types.ObjectId.isValid(shareId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findById(shareId)
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .populate('recipientId', 'name email employeeId department');

    if (!share) {
      throw AppError.notFound('Share record not found.');
    }

    const shareOwnerId = (share.ownerId as any)?._id
      ? (share.ownerId as any)._id.toString()
      : share.ownerId.toString();

    if (shareOwnerId !== ownerId) {
      throw AppError.forbidden('Access denied. Only the share owner can revoke this access.');
    }

    if (share.status === 'REVOKED') {
      throw AppError.badRequest('This share has already been revoked.');
    }

    share.status = 'REVOKED';
    share.revokedAt = new Date();
    await share.save();

    await this.onShareRevoked(share);
    return share.toSafeShare();
  }

  /**
   * Resends an active email share.
   */
  public static async resendEmailShare(
    ownerId: string,
    shareId: string
  ): Promise<{ success: boolean; message: string }> {
    if (!mongoose.Types.ObjectId.isValid(ownerId) || !mongoose.Types.ObjectId.isValid(shareId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findById(shareId)
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department');

    if (!share) {
      throw AppError.notFound('Share record not found.');
    }

    const shareOwnerId = (share.ownerId as any)?._id
      ? (share.ownerId as any)._id.toString()
      : share.ownerId.toString();

    if (shareOwnerId !== ownerId) {
      throw AppError.forbidden('Access denied. Only the share owner can resend this email.');
    }

    if (share.shareMethod !== 'EMAIL' || !share.recipientEmail) {
      throw AppError.badRequest('Only email shares can be resent.');
    }

    if (share.status === 'REVOKED') {
      throw AppError.badRequest('This share was revoked. Please create a new share instead of reactivating a revoked one.');
    }

    if (share.status === 'EXPIRED' || share.expiresAt <= new Date()) {
      share.status = 'EXPIRED';
      await share.save();
      throw AppError.badRequest('This share has expired. Please create a new share instead of reactivating an expired one.');
    }

    // Re-generate fresh access token to ensure security
    const { rawToken, tokenHash } = this.generateShareToken();
    share.shareTokenHash = tokenHash;

    const webBaseUrl = process.env.WEB_BASE_URL || EMAIL_SHARE_CONFIG.webBaseUrl;
    const shareUrl = `${webBaseUrl}/access-share/${rawToken}`;
    const ownerName = (share.ownerId as any)?.name || 'A team member';

    let title = 'Shared Item';
    if (share.resourceType === 'CREDENTIAL' && share.credentialId) {
      title = (share.credentialId as any).title;
    } else if (share.resourceType === 'FILE' && share.fileMetadata) {
      title = share.fileMetadata.originalName;
    }

    const res = await EmailService.sendShareResendEmail({
      recipientEmail: share.recipientEmail,
      senderName: ownerName,
      resourceTitle: title,
      resourceType: share.resourceType,
      expiresAt: share.expiresAt.toISOString(),
      shareUrl,
    });

    share.deliveryStatus = res.success ? 'SENT' : 'FAILED';
    await share.save();

    if (!res.success) {
      return {
        success: false,
        message: 'The share is active, but the email could not be delivered. Please verify recipient email or try again.',
      };
    }

    return {
      success: true,
      message: 'Secure sharing email resent successfully.',
    };
  }

  /**
   * Lists active unexpired credentials shared with the authenticated user.
   */
  public static async listSharedCredentials(recipientId: string): Promise<SharedCredentialItem[]> {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const shares = await CredentialShareModel.find({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      resourceType: 'CREDENTIAL',
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    })
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department')
      .sort({ createdAt: -1 })
      .exec();

    const items: SharedCredentialItem[] = [];

    for (const share of shares) {
      const cred = share.credentialId as any;
      const owner = share.ownerId as any;
      if (!cred || !owner) continue;

      items.push({
        shareId: share._id.toString(),
        credentialId: cred._id.toString(),
        title: cred.title,
        website: cred.website,
        username: cred.username,
        category: cred.category,
        notes: cred.notes,
        permission: share.permission,
        owner: {
          id: owner._id.toString(),
          name: owner.name,
          email: owner.email,
          employeeId: owner.employeeId,
          department: owner.department,
        },
        expiresAt: share.expiresAt.toISOString(),
        status: share.status,
        sharedAt: share.createdAt.toISOString(),
      });
    }

    return items;
  }

  /**
   * Lists active unexpired files shared with the authenticated user.
   */
  public static async listSharedFiles(recipientId: string): Promise<SharedFileItem[]> {
    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const shares = await CredentialShareModel.find({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      resourceType: 'FILE',
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    })
      .populate('ownerId', 'name email employeeId department')
      .populate('credentialId', 'title category website')
      .sort({ createdAt: -1 })
      .exec();

    const items: SharedFileItem[] = [];

    for (const share of shares) {
      const owner = share.ownerId as any;
      if (!share.fileMetadata || !owner) continue;

      const linkedCred = share.credentialId as any;

      items.push({
        shareId: share._id.toString(),
        originalName: share.fileMetadata.originalName,
        sizeBytes: share.fileMetadata.sizeBytes,
        mimeType: share.fileMetadata.mimeType,
        isCompressed: share.fileMetadata.isCompressed,
        fileCount: share.fileMetadata.fileCount,
        permission: share.permission,
        downloadCount: share.downloadCount || 0,
        maxDownloads: share.maxDownloads,
        isCredentialProtected: Boolean(share.credentialId),
        linkedCredentialId: linkedCred?._id?.toString(),
        linkedCredentialTitle: linkedCred?.title,
        owner: {
          id: owner._id.toString(),
          name: owner.name,
          email: owner.email,
          employeeId: owner.employeeId,
          department: owner.department,
        },
        expiresAt: share.expiresAt.toISOString(),
        status: share.status,
        sharedAt: share.createdAt.toISOString(),
      });
    }

    return items;
  }

  /**
   * Retrieves single shared credential metadata for an authorized recipient.
   */
  public static async getSharedCredentialById(
    recipientId: string,
    credentialId: string
  ): Promise<SharedCredentialItem> {
    if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findOne({
      credentialId: new mongoose.Types.ObjectId(credentialId),
      recipientId: new mongoose.Types.ObjectId(recipientId),
      resourceType: 'CREDENTIAL',
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    })
      .populate('credentialId', 'title username category website notes')
      .populate('ownerId', 'name email employeeId department');

    if (!share || !share.credentialId) {
      throw AppError.forbidden('Access denied. You do not have an active share for this credential.');
    }

    const cred = share.credentialId as any;
    const owner = share.ownerId as any;

    return {
      shareId: share._id.toString(),
      credentialId: cred._id.toString(),
      title: cred.title,
      website: cred.website,
      username: cred.username,
      category: cred.category,
      notes: cred.notes,
      permission: share.permission,
      owner: {
        id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        employeeId: owner.employeeId,
        department: owner.department,
      },
      expiresAt: share.expiresAt.toISOString(),
      status: share.status,
      sharedAt: share.createdAt.toISOString(),
    };
  }

  /**
   * Decrypts and reveals shared password strictly if share is ACTIVE, unexpired,
   * and has VIEW_REVEAL permission.
   */
  public static async revealSharedPassword(
    recipientId: string,
    credentialId: string
  ): Promise<SharedRevealResponse> {
    if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findOne({
      credentialId: new mongoose.Types.ObjectId(credentialId),
      recipientId: new mongoose.Types.ObjectId(recipientId),
      resourceType: 'CREDENTIAL',
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    });

    if (!share) {
      throw AppError.forbidden('Access denied. You do not have an active share for this credential.');
    }

    if (share.permission !== 'VIEW_REVEAL') {
      const error = AppError.forbidden(
        'Access denied. Your share permission does not permit revealing this password.'
      );
      (error as any).code = 'REVEAL_PERMISSION_REQUIRED';
      throw error;
    }

    const credential = await CredentialModel.findById(credentialId).select('+encryptedPassword');

    if (!credential || !credential.encryptedPassword) {
      throw AppError.notFound('Target credential record was not found or has been removed.');
    }

    const decryptedPassword = EncryptionService.decrypt(credential.encryptedPassword);
    this.onSharedCredentialRevealed(recipientId, credentialId, share._id.toString());

    return {
      credentialId,
      username: credential.username,
      password: decryptedPassword,
    };
  }

  /**
   * Authorizes and prepares file download for an authenticated recipient (Panel Share).
   */
  public static async getFileDownloadForRecipient(
    recipientId: string,
    shareId: string,
    credentialPassword?: string
  ): Promise<{ filePath: string; originalName: string; mimeType: string }> {
    if (!mongoose.Types.ObjectId.isValid(recipientId) || !mongoose.Types.ObjectId.isValid(shareId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const share = await CredentialShareModel.findOne({
      _id: new mongoose.Types.ObjectId(shareId),
      recipientId: new mongoose.Types.ObjectId(recipientId),
      resourceType: 'FILE',
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    });

    if (!share || !share.fileMetadata) {
      throw AppError.forbidden('Access denied. You do not have active access to this shared file.');
    }

    if (share.permission === 'VIEW') {
      throw AppError.forbidden('This file is shared for view only. Download permission was not granted.');
    }

    if (typeof share.maxDownloads === 'number' && share.downloadCount >= share.maxDownloads) {
      throw AppError.forbidden('The maximum download limit for this shared file has been reached.');
    }

    // Verify linked credential password if protected
    if (share.credentialId) {
      if (!credentialPassword) {
        throw AppError.unauthorized('This file is protected by a linked credential. Please provide the credential password to download.');
      }
      const linkedCred = await CredentialModel.findById(share.credentialId).select('+encryptedPassword');
      if (!linkedCred || !linkedCred.encryptedPassword) {
        throw AppError.notFound('Linked protection credential was not found.');
      }
      const decryptedPassword = EncryptionService.decrypt(linkedCred.encryptedPassword);
      if (credentialPassword !== decryptedPassword) {
        throw AppError.unauthorized('Incorrect credential password. File download denied.');
      }
    }

    const filePath = FileStorageService.getSecureFilePath(share.fileMetadata.storedFilename);

    share.downloadCount = (share.downloadCount || 0) + 1;
    await share.save();

    return {
      filePath,
      originalName: share.fileMetadata.originalName,
      mimeType: share.fileMetadata.mimeType,
    };
  }

  // ===========================================================================
  // 3. PUBLIC / EXTERNAL EMAIL SHARE ACCESS METHODS
  // ===========================================================================

  /**
   * Retrieves public metadata for external share landing page.
   */
  public static async getPublicShareMetadata(rawToken: string): Promise<PublicShareMetadata> {
    if (!rawToken || rawToken.length < 16) {
      throw AppError.badRequest('Invalid share token.');
    }

    const tokenHash = this.hashToken(rawToken);
    const share = await CredentialShareModel.findOne({ shareTokenHash: tokenHash })
      .populate('credentialId', 'title category website')
      .populate('ownerId', 'name');

    if (!share) {
      throw AppError.notFound('Shared item not found or invalid link.');
    }

    return share.toPublicSafeMetadata();
  }

  /**
   * Generates and dispatches a 6-digit OTP to the recipient's verified email.
   */
  public static async requestPublicShareOtp(
    rawToken: string,
    recipientEmail: string
  ): Promise<{ success: boolean; message: string }> {
    if (!rawToken || !recipientEmail) {
      throw AppError.badRequest('Share token and email address are required.');
    }

    const tokenHash = this.hashToken(rawToken);
    const share = await CredentialShareModel.findOne({ shareTokenHash: tokenHash });

    if (!share) {
      throw AppError.notFound('Shared item not found or invalid link.');
    }

    if (share.status === 'REVOKED') {
      throw AppError.badRequest('This shared item is no longer available.');
    }

    if (share.status === 'EXPIRED' || share.expiresAt <= new Date()) {
      share.status = 'EXPIRED';
      await share.save();
      throw AppError.badRequest('This shared item has expired and is no longer available.');
    }

    // Verify requested email matches the intended recipient
    const normalizedInput = recipientEmail.trim().toLowerCase();
    const normalizedTarget = (share.recipientEmail || '').trim().toLowerCase();

    if (normalizedInput !== normalizedTarget) {
      throw AppError.forbidden('The provided email address does not match the recipient of this share.');
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = this.hashToken(otp);
    const ttlMinutes = EMAIL_SHARE_CONFIG.otpTtlMinutes || 10;

    share.otpHash = otpHash;
    share.otpExpiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    share.otpAttempts = 0;
    await share.save();

    const emailRes = await EmailService.sendShareOtpEmail({
      recipientEmail: normalizedTarget,
      otp,
      ttlMinutes,
    });

    if (!emailRes.success) {
      throw AppError.internal('Unable to deliver verification code. Please try again in a few moments.');
    }

    return {
      success: true,
      message: `Verification code sent to ${normalizedTarget}. It will expire in ${ttlMinutes} minutes.`,
    };
  }

  /**
   * Verifies the OTP and unlocks the shared resource data.
   */
  public static async verifyPublicShareOtp(
    rawToken: string,
    recipientEmail: string,
    otp: string
  ): Promise<PublicShareAccessData> {
    if (!rawToken || !recipientEmail || !otp) {
      throw AppError.badRequest('Share token, email, and OTP code are required.');
    }

    const tokenHash = this.hashToken(rawToken);
    const share = await CredentialShareModel.findOne({ shareTokenHash: tokenHash })
      .populate('credentialId', '+encryptedPassword title category website username notes');

    if (!share) {
      throw AppError.notFound('Shared item not found or invalid link.');
    }

    if (share.status === 'REVOKED') {
      throw AppError.badRequest('This shared item is no longer available.');
    }

    if (share.status === 'EXPIRED' || share.expiresAt <= new Date()) {
      share.status = 'EXPIRED';
      await share.save();
      throw AppError.badRequest('This shared item has expired.');
    }

    const normalizedInput = recipientEmail.trim().toLowerCase();
    const normalizedTarget = (share.recipientEmail || '').trim().toLowerCase();

    if (normalizedInput !== normalizedTarget) {
      throw AppError.forbidden('Email verification mismatch.');
    }

    if (!share.otpHash || !share.otpExpiresAt || share.otpExpiresAt <= new Date()) {
      throw AppError.badRequest('Verification code has expired. Please request a new one.');
    }

    if (share.otpAttempts >= (EMAIL_SHARE_CONFIG.maxOtpAttempts || 5)) {
      throw AppError.badRequest('Maximum verification attempts exceeded. Please request a new code.');
    }

    share.otpAttempts = (share.otpAttempts || 0) + 1;

    const providedOtpHash = this.hashToken(otp.trim());
    if (share.otpHash !== providedOtpHash) {
      await share.save();
      throw AppError.badRequest('Incorrect verification code. Please try again.');
    }

    // Invalidate OTP immediately after successful verification
    share.otpHash = undefined;
    share.otpExpiresAt = undefined;
    await share.save();

    // Generate a temporary access ticket valid for streaming / viewing
    const ticket = crypto.randomBytes(24).toString('hex');

    const result: PublicShareAccessData = {
      ticket,
      resourceType: share.resourceType,
      permission: share.permission,
      expiresAt: share.expiresAt.toISOString(),
    };

    if (share.resourceType === 'CREDENTIAL' && share.credentialId) {
      const cred = share.credentialId as any;
      let password: string | undefined = undefined;

      if (share.permission === 'VIEW_REVEAL' && cred.encryptedPassword) {
        password = EncryptionService.decrypt(cred.encryptedPassword);
      }

      result.credential = {
        title: cred.title,
        category: cred.category,
        website: cred.website,
        username: cred.username,
        password,
        notes: cred.notes,
      };
    } else if (share.resourceType === 'FILE' && share.fileMetadata) {
      const remainingDownloads =
        typeof share.maxDownloads === 'number'
          ? Math.max(0, share.maxDownloads - (share.downloadCount || 0))
          : undefined;

      let isCredentialProtected = false;
      let linkedCredentialTitle: string | undefined = undefined;
      if (share.credentialId) {
        isCredentialProtected = true;
        const linkedCred = share.credentialId as any;
        if (linkedCred && linkedCred.title) {
          linkedCredentialTitle = linkedCred.title;
        }
      }

      result.file = {
        fileName: share.fileMetadata.originalName,
        fileSizeBytes: share.fileMetadata.sizeBytes,
        mimeType: share.fileMetadata.mimeType,
        isCompressed: share.fileMetadata.isCompressed,
        canDownload: share.permission !== 'VIEW',
        remainingDownloads,
        isCredentialProtected,
        linkedCredentialTitle,
      };
    }

    return result;
  }

  /**
   * Authorizes and prepares file download for external recipients using the raw share token.
   */
  public static async getPublicFileDownload(
    rawToken: string,
    credentialPassword?: string
  ): Promise<{ filePath: string; originalName: string; mimeType: string }> {
    if (!rawToken) {
      throw AppError.badRequest('Share token is required.');
    }

    const tokenHash = this.hashToken(rawToken);
    const share = await CredentialShareModel.findOne({
      shareTokenHash: tokenHash,
      resourceType: 'FILE',
      status: 'ACTIVE',
      expiresAt: { $gt: new Date() },
    });

    if (!share || !share.fileMetadata) {
      throw AppError.forbidden('Access denied. Share is expired, revoked, or not found.');
    }

    if (share.permission === 'VIEW') {
      throw AppError.forbidden('This file is shared for online viewing only. Download is not permitted.');
    }

    if (typeof share.maxDownloads === 'number' && share.downloadCount >= share.maxDownloads) {
      throw AppError.forbidden('The download limit for this shared file has been reached.');
    }

    // Verify linked credential password if protected
    if (share.credentialId) {
      if (!credentialPassword) {
        throw AppError.unauthorized('This file is protected by a linked credential. Please provide the credential password to download.');
      }
      const linkedCred = await CredentialModel.findById(share.credentialId).select('+encryptedPassword');
      if (!linkedCred || !linkedCred.encryptedPassword) {
        throw AppError.notFound('Linked protection credential was not found.');
      }
      const decryptedPassword = EncryptionService.decrypt(linkedCred.encryptedPassword);
      if (credentialPassword !== decryptedPassword) {
        throw AppError.unauthorized('Incorrect credential password. File download denied.');
      }
    }

    const filePath = FileStorageService.getSecureFilePath(share.fileMetadata.storedFilename);

    share.downloadCount = (share.downloadCount || 0) + 1;
    await share.save();

    return {
      filePath,
      originalName: share.fileMetadata.originalName,
      mimeType: share.fileMetadata.mimeType,
    };
  }

  /**
   * Lists active employees available as share recipients (excluding the current user).
   */
  public static async listEligibleRecipients(currentUserId: string): Promise<ShareRecipientOption[]> {
    const users = await UserModel.find({
      _id: { $ne: new mongoose.Types.ObjectId(currentUserId) },
      status: 'ACTIVE',
    })
      .select('name email employeeId department role')
      .sort({ name: 1 })
      .exec();

    return users.map((u) => ({
      id: u._id.toString(),
      name: u.name,
      email: u.email,
      employeeId: u.employeeId,
      department: u.department,
      role: u.role,
    }));
  }

  // --------------------------------------------------------------------------
  // Notification & Email Lifecycle Hooks
  // --------------------------------------------------------------------------

  private static async onShareCreated(share: ICredentialShareDocument): Promise<void> {
    const owner = share.ownerId as any;
    const recipient = share.recipientId as any;
    const cred = share.credentialId as any;

    const recipientIdStr = recipient?._id ? recipient._id.toString() : recipient?.toString() || '';
    const ownerName = owner?.name || 'An employee';
    const ownerEmail = owner?.email || '';
    const credTitle = cred?.title || 'Credential';
    const credCategory = cred?.category || 'OTHER';

    logger.info(`[CredentialShareService]: Credential share created [ID: ${share._id}] by Owner [${ownerName}] for Recipient [${recipient?.name || recipientIdStr}]`);

    if (recipientIdStr) {
      try {
        await NotificationService.createNotification({
          recipientId: recipientIdStr,
          type: 'SHARE_REQUEST_RECEIVED',
          title: 'New Credential Share Request',
          message: `${ownerName} has shared access to credential "${credTitle}" with you. Review the request to accept or decline access.`,
          relatedEntityType: 'CredentialShare',
          relatedEntityId: share._id.toString(),
          dispatchEmail: async () => {
            if (recipient?.email) {
              return EmailService.sendShareRequestReceivedEmail({
                recipientEmail: recipient.email,
                recipientName: recipient.name || 'Employee',
                senderName: ownerName,
                senderEmail: ownerEmail,
                credentialTitle: credTitle,
                credentialCategory: credCategory,
                permission: share.permission,
                expiresAt: share.expiresAt.toISOString(),
              });
            }
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown notification error';
        ApiLogger.warn('CredentialShareService', `Failed to create share received notification: ${msg}`);
      }
    }
  }

  private static async onFileShareCreated(share: ICredentialShareDocument): Promise<void> {
    const owner = share.ownerId as any;
    const recipient = share.recipientId as any;
    const fileName = share.fileMetadata?.originalName || 'File Package';

    const recipientIdStr = recipient?._id ? recipient._id.toString() : recipient?.toString() || '';
    const ownerName = owner?.name || 'An employee';

    logger.info(`[CredentialShareService]: File share created [ID: ${share._id}] by Owner [${ownerName}] for Recipient [${recipient?.name || recipientIdStr}]`);

    if (recipientIdStr) {
      try {
        await NotificationService.createNotification({
          recipientId: recipientIdStr,
          type: 'SHARE_REQUEST_RECEIVED',
          title: 'New File Share Request',
          message: `${ownerName} has shared file "${fileName}" with you. Review the request to accept access.`,
          relatedEntityType: 'CredentialShare',
          relatedEntityId: share._id.toString(),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown notification error';
        ApiLogger.warn('CredentialShareService', `Failed to create file share received notification: ${msg}`);
      }
    }
  }

  private static async onShareApproved(share: ICredentialShareDocument): Promise<void> {
    const owner = share.ownerId as any;
    const recipient = share.recipientId as any;
    const cred = share.credentialId as any;
    const itemTitle = cred?.title || share.fileMetadata?.originalName || 'Shared Item';

    const ownerIdStr = owner?._id ? owner._id.toString() : owner?.toString() || '';
    const recipientName = recipient?.name || 'Recipient';

    logger.info(`[CredentialShareService]: Share approved [ID: ${share._id}] by Recipient [${recipientName}]`);

    if (ownerIdStr) {
      try {
        await NotificationService.createNotification({
          recipientId: ownerIdStr,
          type: 'SHARE_REQUEST_APPROVED',
          title: 'Share Request Accepted',
          message: `${recipientName} accepted your sharing request for "${itemTitle}".`,
          relatedEntityType: 'CredentialShare',
          relatedEntityId: share._id.toString(),
          dispatchEmail: async () => {
            if (owner?.email && cred) {
              return EmailService.sendShareApprovedEmail({
                ownerEmail: owner.email,
                ownerName: owner.name || 'Owner',
                recipientName,
                credentialTitle: itemTitle,
                permission: share.permission,
              });
            }
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown notification error';
        ApiLogger.warn('CredentialShareService', `Failed to create share approved notification: ${msg}`);
      }
    }
  }

  private static async onShareRejected(share: ICredentialShareDocument): Promise<void> {
    const owner = share.ownerId as any;
    const recipient = share.recipientId as any;
    const cred = share.credentialId as any;
    const itemTitle = cred?.title || share.fileMetadata?.originalName || 'Shared Item';

    const ownerIdStr = owner?._id ? owner._id.toString() : owner?.toString() || '';
    const recipientName = recipient?.name || 'Recipient';

    logger.info(`[CredentialShareService]: Share rejected [ID: ${share._id}] by Recipient [${recipientName}]`);

    if (ownerIdStr) {
      try {
        await NotificationService.createNotification({
          recipientId: ownerIdStr,
          type: 'SHARE_REQUEST_REJECTED',
          title: 'Share Request Declined',
          message: `${recipientName} declined your sharing request for "${itemTitle}".`,
          relatedEntityType: 'CredentialShare',
          relatedEntityId: share._id.toString(),
          dispatchEmail: async () => {
            if (owner?.email && cred) {
              return EmailService.sendShareRejectedEmail({
                ownerEmail: owner.email,
                ownerName: owner.name || 'Owner',
                recipientName,
                credentialTitle: itemTitle,
              });
            }
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown notification error';
        ApiLogger.warn('CredentialShareService', `Failed to create share rejected notification: ${msg}`);
      }
    }
  }

  private static async onShareRevoked(share: ICredentialShareDocument): Promise<void> {
    const owner = share.ownerId as any;
    const recipient = share.recipientId as any;
    const cred = share.credentialId as any;
    const itemTitle = cred?.title || share.fileMetadata?.originalName || 'Shared Item';

    const recipientIdStr = recipient?._id ? recipient._id.toString() : recipient?.toString() || '';
    const ownerName = owner?.name || 'The owner';

    logger.info(`[CredentialShareService]: Share revoked [ID: ${share._id}] by Owner [${ownerName}]`);

    if (recipientIdStr) {
      try {
        await NotificationService.createNotification({
          recipientId: recipientIdStr,
          type: 'SHARE_REVOKED',
          title: 'Access Revoked',
          message: `Your access to shared item "${itemTitle}" has been revoked by ${ownerName}.`,
          relatedEntityType: 'CredentialShare',
          relatedEntityId: share._id.toString(),
          dispatchEmail: async () => {
            if (recipient?.email && cred) {
              return EmailService.sendShareRevokedEmail({
                recipientEmail: recipient.email,
                recipientName: recipient?.name || 'Employee',
                ownerName,
                credentialTitle: itemTitle,
              });
            }
          },
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown notification error';
        ApiLogger.warn('CredentialShareService', `Failed to create share revoked notification: ${msg}`);
      }
    }
  }

  private static onSharedCredentialRevealed(recipientId: string, credentialId: string, shareId: string): void {
    logger.info(`[CredentialShareService]: Shared credential revealed [ID: ${credentialId}] via Share [ID: ${shareId}] by User [ID: ${recipientId}]`);
  }
}
