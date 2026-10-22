import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { CredentialShareService } from '../services/credential-share.service.js';
import { AuditService } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';

export class CredentialShareController {
  /**
   * POST /api/v1/credential-shares
   */
  public static async createShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');

      const files = req.files as Express.Multer.File[] | undefined;
      const share = await CredentialShareService.createShare(req.user.id, req.body, files);

      // Determine Audit Action
      let action: any = 'SHARE_CREATED';
      if (share.resourceType === 'FILE' && share.shareMethod === 'EMAIL') {
        action = 'FILE_EMAIL_SHARE_CREATED';
      } else if (share.resourceType === 'FILE') {
        action = 'FILE_SHARE_CREATED';
      } else if (share.shareMethod === 'EMAIL') {
        action = 'CREDENTIAL_EMAIL_SHARE_CREATED';
      }

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action,
        category: 'SHARING',
        resourceType: share.resourceType === 'FILE' ? 'File' : 'CredentialShare',
        resourceId: share.id,
        targetUserId: req.body.recipientId,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          shareId: share.id,
          resourceType: share.resourceType,
          shareMethod: share.shareMethod,
          recipientType: share.recipientType,
          recipientEmail: share.recipientEmail,
          permission: share.permission,
          expiresAt: share.expiresAt,
        },
      });

      res.status(201).json(
        createSuccessResponse({ share }, 'Share request created successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credential-shares/incoming
   */
  public static async listIncoming(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const shares = await CredentialShareService.listIncomingShares(req.user.id);
      res.status(200).json(
        createSuccessResponse({ shares }, 'Incoming share requests retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credential-shares/outgoing
   */
  public static async listOutgoing(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const shares = await CredentialShareService.listOutgoingShares(req.user.id);
      res.status(200).json(
        createSuccessResponse({ shares }, 'Outgoing shares retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credential-shares/emails
   */
  public static async listEmailShares(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const shares = await CredentialShareService.listEmailShares(req.user.id);
      res.status(200).json(
        createSuccessResponse({ shares }, 'Email shares retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credential-shares/:id/resend-email
   */
  public static async resendEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const result = await CredentialShareService.resendEmailShare(req.user.id, req.params.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'EMAIL_SHARE_RESENT',
        category: 'SHARING',
        resourceType: 'CredentialShare',
        resourceId: req.params.id,
        result: result.success ? 'SUCCESS' : 'FAILURE',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });

      res.status(200).json(createSuccessResponse(result, result.message, req.id));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credential-shares/:id/approve
   */
  public static async approveShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const share = await CredentialShareService.approveShare(req.user.id, req.params.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'SHARE_APPROVED',
        category: 'SHARING',
        resourceType: 'CredentialShare',
        resourceId: share.id,
        targetUserId: typeof share.owner === 'object' ? share.owner.id : undefined,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          shareId: share.id,
          credentialId: share.credentialId,
          permission: share.permission,
        },
      });

      res.status(200).json(
        createSuccessResponse({ share }, 'Share request approved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credential-shares/:id/reject
   */
  public static async rejectShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const share = await CredentialShareService.rejectShare(req.user.id, req.params.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'SHARE_REJECTED',
        category: 'SHARING',
        resourceType: 'CredentialShare',
        resourceId: share.id,
        targetUserId: typeof share.owner === 'object' ? share.owner.id : undefined,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          shareId: share.id,
          credentialId: share.credentialId,
        },
      });

      res.status(200).json(
        createSuccessResponse({ share }, 'Share request rejected successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credential-shares/:id/revoke
   */
  public static async revokeShare(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const share = await CredentialShareService.revokeShare(req.user.id, req.params.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'SHARE_REVOKED',
        category: 'SHARING',
        resourceType: 'CredentialShare',
        resourceId: share.id,
        targetUserId: typeof share.recipient === 'object' ? share.recipient.id : undefined,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          shareId: share.id,
          resourceType: share.resourceType,
          shareMethod: share.shareMethod,
        },
      });

      res.status(200).json(
        createSuccessResponse({ share }, 'Share revoked successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credential-shares/recipients
   */
  public static async listRecipients(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const recipients = await CredentialShareService.listEligibleRecipients(req.user.id);
      res.status(200).json(
        createSuccessResponse({ recipients }, 'Eligible share recipients retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credentials/shared
   */
  public static async listSharedCredentials(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const items = await CredentialShareService.listSharedCredentials(req.user.id);
      res.status(200).json(
        createSuccessResponse({ items }, 'Shared credentials retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credentials/shared/files
   */
  public static async listSharedFiles(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const items = await CredentialShareService.listSharedFiles(req.user.id);
      res.status(200).json(
        createSuccessResponse({ items }, 'Shared files retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credentials/shared/:id
   */
  public static async getSharedCredential(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const credential = await CredentialShareService.getSharedCredentialById(req.user.id, req.params.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'SHARED_CREDENTIAL_VIEWED',
        category: 'SHARING',
        resourceType: 'Credential',
        resourceId: credential.credentialId,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          shareId: credential.shareId,
          title: credential.title,
          permission: credential.permission,
        },
      });

      res.status(200).json(
        createSuccessResponse({ credential }, 'Shared credential retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credentials/shared/:id/reveal
   */
  public static async revealSharedPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');
      const data = await CredentialShareService.revealSharedPassword(req.user.id, req.params.id);

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: 'SHARED_CREDENTIAL_REVEALED',
        category: 'SHARING',
        resourceType: 'Credential',
        resourceId: data.credentialId,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          username: data.username,
          accessType: 'SHARED_REVEAL',
        },
      });

      res.status(200).json(
        createSuccessResponse(data, 'Shared password revealed successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credential-shares/:id/download (Panel Share Authenticated File Download)
   */
  public static async downloadPanelSharedFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required.');

      const credentialPassword =
        (req.headers['x-credential-password'] as string) ||
        (req.query.password as string) ||
        (req.body?.password as string) ||
        (req.body?.credentialPassword as string);

      const fileInfo = await CredentialShareService.getFileDownloadForRecipient(
        req.user.id,
        req.params.id,
        credentialPassword
      );

      await AuditService.record({
        actorId: req.user.id,
        actorEmail: req.user.employeeId,
        actorRole: req.user.role,
        action: credentialPassword ? 'FILE_DOWNLOAD_AUTHENTICATED' : 'FILE_DOWNLOADED',
        category: 'SHARING',
        resourceType: 'File',
        resourceId: req.params.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          shareId: req.params.id,
          fileName: fileInfo.originalName,
          protected: Boolean(credentialPassword),
        },
      });

      res.setHeader('Content-Type', fileInfo.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(fileInfo.filePath);
    } catch (error) {
      next(error);
    }
  }

  // ===========================================================================
  // Public External Share Endpoints
  // ===========================================================================

  /**
   * GET /api/v1/credential-shares/public/:token
   */
  public static async getPublicShareMetadata(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const metadata = await CredentialShareService.getPublicShareMetadata(req.params.token);

      await AuditService.record({
        actorRole: 'SYSTEM',
        action: 'SHARE_ACCESSED',
        category: 'SHARING',
        resourceType: 'CredentialShare',
        resourceId: metadata.shareId,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });

      res.status(200).json(
        createSuccessResponse({ metadata }, 'Share metadata retrieved successfully.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credential-shares/public/:token/otp/request
   */
  public static async requestPublicShareOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await CredentialShareService.requestPublicShareOtp(
        req.params.token,
        req.body.email
      );

      await AuditService.record({
        actorRole: 'SYSTEM',
        action: 'SHARE_OTP_REQUESTED',
        category: 'SHARING',
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });

      res.status(200).json(createSuccessResponse(result, result.message, req.id));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credential-shares/public/:token/otp/verify
   */
  public static async verifyPublicShareOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const accessData = await CredentialShareService.verifyPublicShareOtp(
        req.params.token,
        req.body.email,
        req.body.otp
      );

      await AuditService.record({
        actorRole: 'SYSTEM',
        action: 'SHARE_OTP_VERIFIED',
        category: 'SHARING',
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      });

      res.status(200).json(
        createSuccessResponse({ accessData }, 'Verification successful. Access granted.', req.id)
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credential-shares/public/:token/download
   */
  public static async downloadPublicFile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const credentialPassword =
        (req.headers['x-credential-password'] as string) ||
        (req.query.password as string) ||
        (req.body?.password as string) ||
        (req.body?.credentialPassword as string);

      const fileInfo = await CredentialShareService.getPublicFileDownload(
        req.params.token,
        credentialPassword
      );

      await AuditService.record({
        actorRole: 'SYSTEM',
        action: credentialPassword ? 'FILE_DOWNLOAD_AUTHENTICATED' : 'FILE_DOWNLOADED',
        category: 'SHARING',
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          fileName: fileInfo.originalName,
          accessChannel: 'PUBLIC_EMAIL',
          protected: Boolean(credentialPassword),
        },
      });

      res.setHeader('Content-Type', fileInfo.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(fileInfo.filePath);
    } catch (error) {
      next(error);
    }
  }
}
