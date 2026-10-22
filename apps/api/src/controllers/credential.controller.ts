import { Request, Response, NextFunction } from 'express';
import { createSuccessResponse } from '@credential-manager/shared';
import { CredentialService } from '../services/credential.service.js';
import { PasswordGenerator } from '../utils/password-generator.js';
import { AuditService } from '../services/audit.service.js';
import { AppError } from '../utils/errors.js';

export class CredentialController {
  /**
   * POST /api/v1/credentials
   * Creates a new encrypted credential.
   */
  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const credential = await CredentialService.createCredential(req.user.id, req.body);

      AuditService.record({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREDENTIAL_CREATED',
        category: 'CREDENTIAL',
        resourceType: 'Credential',
        resourceId: credential.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          title: credential.title,
          category: credential.category,
          website: credential.website,
        },
      }).catch(() => {});

      res.status(201).json(
        createSuccessResponse(
          { credential },
          'Credential created and encrypted with AES-256-GCM successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credentials
   * Lists credentials with pagination, search, category filter, and favorite filter.
   */
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const result = await CredentialService.listCredentials(req.user.id, req.query as any);

      res.status(200).json(
        createSuccessResponse(
          result,
          'Credentials retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/credentials/:id
   * Retrieves single credential metadata.
   */
  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const credential = await CredentialService.getCredentialById(req.user.id, req.params.id);

      AuditService.record({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREDENTIAL_VIEWED',
        category: 'CREDENTIAL',
        resourceType: 'Credential',
        resourceId: credential.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          title: credential.title,
          category: credential.category,
        },
      }).catch(() => {});

      res.status(200).json(
        createSuccessResponse(
          { credential },
          'Credential details retrieved successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/credentials/:id
   * Updates credential metadata or re-encrypts updated password.
   */
  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const credential = await CredentialService.updateCredential(
        req.user.id,
        req.params.id,
        req.body
      );

      AuditService.record({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREDENTIAL_UPDATED',
        category: 'CREDENTIAL',
        resourceType: 'Credential',
        resourceId: credential.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          title: credential.title,
          category: credential.category,
          passwordUpdated: Boolean(req.body.password),
        },
      }).catch(() => {});

      res.status(200).json(
        createSuccessResponse(
          { credential },
          'Credential updated successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/credentials/:id
   * Deletes a credential.
   */
  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      await CredentialService.deleteCredential(req.user.id, req.params.id);

      AuditService.record({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREDENTIAL_DELETED',
        category: 'CREDENTIAL',
        resourceType: 'Credential',
        resourceId: req.params.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
      }).catch(() => {});

      res.status(200).json(
        createSuccessResponse(
          { deleted: true },
          'Credential deleted successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credentials/:id/reveal
   * Explicitly reveals decrypted password for the owner.
   */
  public static async reveal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required.');
      }

      const secret = await CredentialService.revealCredential(req.user.id, req.params.id);

      // Record credential reveal event (Strictly WITHOUT saving secret password)
      AuditService.record({
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREDENTIAL_REVEALED',
        category: 'CREDENTIAL',
        resourceType: 'Credential',
        resourceId: req.params.id,
        result: 'SUCCESS',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId: req.id,
        metadata: {
          accessType: 'OWNER',
          username: secret.username,
        },
      }).catch(() => {});

      res.status(200).json(
        createSuccessResponse(
          secret,
          'Credential secret revealed successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/credentials/generate-password
   * Cryptographically generates a secure password.
   */
  public static async generatePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const password = PasswordGenerator.generate(req.body);

      res.status(200).json(
        createSuccessResponse(
          { password },
          'Cryptographically secure password generated successfully.',
          req.id
        )
      );
    } catch (error) {
      next(error);
    }
  }
}
