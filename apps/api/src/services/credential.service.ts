import mongoose from 'mongoose';
import {
  CreateCredentialDto,
  CredentialCategory,
  CredentialPaginationResult,
  ICredentialListItem,
  RevealCredentialResponse,
  UpdateCredentialDto,
} from '@credential-manager/types';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';
import { logger } from '@credential-manager/shared';
import { CredentialModel, ICredentialDocument } from '../models/credential.model.js';
import { EncryptionService } from './encryption.service.js';
import { PasswordHealthService } from './password-health/password-health.service.js';
import { AppError } from '../utils/errors.js';

export interface ListCredentialsFilter {
  page?: number;
  limit?: number;
  search?: string;
  category?: CredentialCategory;
  favorite?: boolean;
}

export class CredentialService {
  /**
   * Creates a new credential with AES-256-GCM encrypted password payload.
   * Plaintext password is NEVER stored in database.
   */
  public static async createCredential(
    userId: string,
    dto: CreateCredentialDto
  ): Promise<ICredentialListItem> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    // Encrypt sensitive password using AES-256-GCM
    const encryptedPassword = EncryptionService.encrypt(dto.password);

    const credential = await CredentialModel.create({
      ownerId: new mongoose.Types.ObjectId(userId),
      title: dto.title.trim(),
      website: dto.website?.trim() || '',
      username: dto.username.trim(),
      encryptedPassword,
      category: dto.category || 'OTHER',
      notes: dto.notes?.trim() || '',
      favorite: Boolean(dto.favorite),
      passwordChangedAt: new Date(),
    });

    // Invalidate cached password health analysis
    PasswordHealthService.invalidateCache(userId).catch((err) =>
      logger.warn(`[CredentialService]: Failed to invalidate health cache on create: ${String(err)}`)
    );

    this.onCredentialCreated(userId, credential._id.toString());
    return credential.toSafeCredential();
  }

  /**
   * Lists credentials belonging strictly to the authenticated user.
   * Supports pagination, category filter, favorite toggle, and search over metadata fields.
   */
  public static async listCredentials(
    userId: string,
    filter: ListCredentialsFilter = {}
  ): Promise<CredentialPaginationResult> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid user identifier.');
    }

    const page = filter.page || CREDENTIAL_CONFIG.defaultPage;
    const limit = filter.limit || CREDENTIAL_CONFIG.defaultPageLimit;
    const skip = (page - 1) * limit;

    // Strict ownership condition
    const query: Record<string, unknown> = {
      ownerId: new mongoose.Types.ObjectId(userId),
    };

    if (filter.category) {
      query.category = filter.category;
    }

    if (filter.favorite !== undefined) {
      query.favorite = filter.favorite;
    }

    if (filter.search && filter.search.trim()) {
      const searchRegex = new RegExp(filter.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [
        { title: searchRegex },
        { website: searchRegex },
        { username: searchRegex },
      ];
    }

    const [total, documents] = await Promise.all([
      CredentialModel.countDocuments(query),
      CredentialModel.find(query)
        .sort({ favorite: -1, updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
    ]);

    const items = documents.map((doc) => doc.toSafeCredential());
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieves single credential metadata by ID with ownership verification.
   */
  public static async getCredentialById(
    userId: string,
    credentialId: string
  ): Promise<ICredentialListItem> {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const credential = await CredentialModel.findOne({
      _id: new mongoose.Types.ObjectId(credentialId),
      ownerId: new mongoose.Types.ObjectId(userId),
    });

    if (!credential) {
      // Check if credential exists under another user to avoid leaking existence
      const existsElsewhere = await CredentialModel.exists({
        _id: new mongoose.Types.ObjectId(credentialId),
      });
      if (existsElsewhere) {
        throw AppError.forbidden('Access denied. You do not have permission to view this credential.');
      }
      throw AppError.notFound('Credential not found.');
    }

    return credential.toSafeCredential();
  }

  /**
   * Updates credential metadata or re-encrypts updated password.
   */
  public static async updateCredential(
    userId: string,
    credentialId: string,
    dto: UpdateCredentialDto
  ): Promise<ICredentialListItem> {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const credential = await CredentialModel.findOne({
      _id: new mongoose.Types.ObjectId(credentialId),
      ownerId: new mongoose.Types.ObjectId(userId),
    });

    if (!credential) {
      const existsElsewhere = await CredentialModel.exists({
        _id: new mongoose.Types.ObjectId(credentialId),
      });
      if (existsElsewhere) {
        throw AppError.forbidden('Access denied. You do not have permission to modify this credential.');
      }
      throw AppError.notFound('Credential not found.');
    }

    if (dto.title !== undefined) credential.title = dto.title.trim();
    if (dto.website !== undefined) credential.website = dto.website.trim();
    if (dto.username !== undefined) credential.username = dto.username.trim();
    if (dto.category !== undefined) credential.category = dto.category;
    if (dto.notes !== undefined) credential.notes = dto.notes.trim();
    if (dto.favorite !== undefined) credential.favorite = dto.favorite;

    // Re-encrypt password with fresh IV if a new password is provided
    if (dto.password && dto.password.trim()) {
      credential.encryptedPassword = EncryptionService.encrypt(dto.password);
      credential.passwordChangedAt = new Date();
    }

    await credential.save();

    // Invalidate cached password health analysis
    PasswordHealthService.invalidateCache(userId).catch((err) =>
      logger.warn(`[CredentialService]: Failed to invalidate health cache on update: ${String(err)}`)
    );

    this.onCredentialUpdated(userId, credentialId);
    return credential.toSafeCredential();
  }

  /**
   * Deletes credential with ownership verification.
   */
  public static async deleteCredential(
    userId: string,
    credentialId: string
  ): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const result = await CredentialModel.deleteOne({
      _id: new mongoose.Types.ObjectId(credentialId),
      ownerId: new mongoose.Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      const existsElsewhere = await CredentialModel.exists({
        _id: new mongoose.Types.ObjectId(credentialId),
      });
      if (existsElsewhere) {
        throw AppError.forbidden('Access denied. You do not have permission to delete this credential.');
      }
      throw AppError.notFound('Credential not found.');
    }

    // Invalidate cached password health analysis
    PasswordHealthService.invalidateCache(userId).catch((err) =>
      logger.warn(`[CredentialService]: Failed to invalidate health cache on delete: ${String(err)}`)
    );

    this.onCredentialDeleted(userId, credentialId);
    return true;
  }

  /**
   * Dedicated secure reveal endpoint: Decrypts AES-256-GCM encrypted password for owner.
   * Returns only required plaintext secret.
   */
  public static async revealCredential(
    userId: string,
    credentialId: string
  ): Promise<RevealCredentialResponse> {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(credentialId)) {
      throw AppError.badRequest('Invalid identifier format.');
    }

    const credential = await CredentialModel.findOne({
      _id: new mongoose.Types.ObjectId(credentialId),
      ownerId: new mongoose.Types.ObjectId(userId),
    }).select('+encryptedPassword');

    if (!credential) {
      const existsElsewhere = await CredentialModel.exists({
        _id: new mongoose.Types.ObjectId(credentialId),
      });
      if (existsElsewhere) {
        throw AppError.forbidden('Access denied. You do not have permission to reveal this credential.');
      }
      throw AppError.notFound('Credential not found.');
    }

    if (!credential.encryptedPassword) {
      throw AppError.internal('Encrypted password payload is missing on target record.');
    }

    // Decrypt AES-256-GCM ciphertext
    const decryptedPassword = EncryptionService.decrypt(credential.encryptedPassword);

    this.onCredentialRevealed(userId, credentialId);

    return {
      username: credential.username,
      password: decryptedPassword,
    };
  }

  // --------------------------------------------------------------------------
  // Activity Tracking Hooks (Prepared for Phase 10 Audit Logging System)
  // --------------------------------------------------------------------------

  private static onCredentialCreated(userId: string, credentialId: string): void {
    logger.info(`[CredentialService]: Credential created [ID: ${credentialId}] by User [ID: ${userId}]`);
  }

  private static onCredentialUpdated(userId: string, credentialId: string): void {
    logger.info(`[CredentialService]: Credential updated [ID: ${credentialId}] by User [ID: ${userId}]`);
  }

  private static onCredentialDeleted(userId: string, credentialId: string): void {
    logger.info(`[CredentialService]: Credential deleted [ID: ${credentialId}] by User [ID: ${userId}]`);
  }

  private static onCredentialRevealed(userId: string, credentialId: string): void {
    logger.info(`[CredentialService]: Credential revealed [ID: ${credentialId}] by User [ID: ${userId}]`);
  }
}
