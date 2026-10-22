import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  ICredentialShare,
  IFileMetadata,
  PublicShareMetadata,
  RecipientType,
  ShareDeliveryStatus,
  ShareMethod,
  ShareResourceType,
  ShareStatus,
  UnifiedSharePermission,
} from '@credential-manager/types';
import { SHARE_CONFIG } from '@credential-manager/config';

export interface ICredentialShareDocument extends Document {
  _id: Types.ObjectId;
  resourceType: ShareResourceType;
  shareMethod: ShareMethod;
  recipientType: RecipientType;
  credentialId?: Types.ObjectId;
  ownerId: Types.ObjectId;
  recipientId?: Types.ObjectId;
  recipientEmail?: string;
  fileMetadata?: IFileMetadata;
  permission: UnifiedSharePermission;
  status: ShareStatus;
  deliveryStatus?: ShareDeliveryStatus;
  shareTokenHash?: string;
  otpHash?: string;
  otpExpiresAt?: Date;
  otpAttempts: number;
  downloadCount: number;
  maxDownloads?: number;
  expiresAt: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  toSafeShare(): ICredentialShare;
  toPublicSafeMetadata(): PublicShareMetadata;
}

const CredentialShareSchema = new Schema<ICredentialShareDocument>(
  {
    resourceType: {
      type: String,
      enum: {
        values: SHARE_CONFIG.resourceTypes,
        message: '{VALUE} is not a valid share resource type',
      },
      required: true,
      default: 'CREDENTIAL',
      index: true,
    },
    shareMethod: {
      type: String,
      enum: {
        values: SHARE_CONFIG.shareMethods,
        message: '{VALUE} is not a valid share method',
      },
      required: true,
      default: 'PANEL',
      index: true,
    },
    recipientType: {
      type: String,
      enum: {
        values: SHARE_CONFIG.recipientTypes,
        message: '{VALUE} is not a valid recipient type',
      },
      required: true,
      default: 'REGISTERED',
      index: true,
    },
    credentialId: {
      type: Schema.Types.ObjectId,
      ref: 'Credential',
      required: false,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner reference is required'],
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: false,
      index: true,
    },
    fileMetadata: {
      originalName: { type: String },
      storedFilename: { type: String },
      mimeType: { type: String },
      sizeBytes: { type: Number },
      isCompressed: { type: Boolean, default: false },
      fileCount: { type: Number, default: 1 },
      filesList: [
        {
          originalName: { type: String },
          sizeBytes: { type: Number },
          mimeType: { type: String },
        },
      ],
    },
    permission: {
      type: String,
      required: [true, 'Share permission is required'],
      default: 'VIEW',
    },
    status: {
      type: String,
      enum: {
        values: SHARE_CONFIG.statuses,
        message: '{VALUE} is not a valid share status',
      },
      required: [true, 'Share status is required'],
      default: 'PENDING',
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: {
        values: SHARE_CONFIG.deliveryStatuses,
        message: '{VALUE} is not a valid delivery status',
      },
      default: 'PENDING',
    },
    shareTokenHash: {
      type: String,
      required: false,
      index: true,
    },
    otpHash: {
      type: String,
      required: false,
    },
    otpExpiresAt: {
      type: Date,
      required: false,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
    maxDownloads: {
      type: Number,
      required: false,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Expiration date is required'],
      index: true,
    },
    approvedAt: {
      type: Date,
      default: undefined,
    },
    rejectedAt: {
      type: Date,
      default: undefined,
    },
    revokedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    collection: 'credential_shares',
  }
);

// Compound indexes for authorization and listing queries
CredentialShareSchema.index({ credentialId: 1, recipientId: 1, status: 1 });
CredentialShareSchema.index({ recipientId: 1, status: 1, createdAt: -1 });
CredentialShareSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
CredentialShareSchema.index({ ownerId: 1, shareMethod: 1, createdAt: -1 });

/**
 * Sanitizes share document into a safe API response.
 * Never leaks ciphertext, IV, authTag, secrets, share tokens, or OTP hashes.
 */
CredentialShareSchema.methods.toSafeShare = function (this: ICredentialShareDocument): ICredentialShare {
  const isPopulated = (doc: unknown): doc is Record<string, unknown> =>
    typeof doc === 'object' && doc !== null && '_id' in doc;

  const result: ICredentialShare = {
    id: this._id.toString(),
    resourceType: this.resourceType || 'CREDENTIAL',
    shareMethod: this.shareMethod || 'PANEL',
    recipientType: this.recipientType || 'REGISTERED',
    credentialId: this.credentialId
      ? isPopulated(this.credentialId)
        ? (this.credentialId._id as Types.ObjectId).toString()
        : this.credentialId.toString()
      : undefined,
    ownerId: this.ownerId
      ? isPopulated(this.ownerId)
        ? (this.ownerId._id as Types.ObjectId).toString()
        : this.ownerId.toString()
      : '',
    recipientId: this.recipientId
      ? isPopulated(this.recipientId)
        ? (this.recipientId._id as Types.ObjectId).toString()
        : this.recipientId.toString()
      : undefined,
    recipientEmail: this.recipientEmail,
    fileMetadata: this.fileMetadata
      ? {
          originalName: this.fileMetadata.originalName,
          storedFilename: this.fileMetadata.storedFilename,
          mimeType: this.fileMetadata.mimeType,
          sizeBytes: this.fileMetadata.sizeBytes,
          isCompressed: this.fileMetadata.isCompressed,
          fileCount: this.fileMetadata.fileCount,
          filesList: this.fileMetadata.filesList,
        }
      : undefined,
    permission: this.permission,
    status: this.status,
    deliveryStatus: this.deliveryStatus,
    downloadCount: this.downloadCount || 0,
    maxDownloads: this.maxDownloads,
    expiresAt: this.expiresAt.toISOString(),
    approvedAt: this.approvedAt ? this.approvedAt.toISOString() : undefined,
    rejectedAt: this.rejectedAt ? this.rejectedAt.toISOString() : undefined,
    revokedAt: this.revokedAt ? this.revokedAt.toISOString() : undefined,
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };

  if (this.credentialId && isPopulated(this.credentialId)) {
    const cred = this.credentialId as any;
    result.credential = {
      id: cred._id.toString(),
      title: cred.title,
      username: cred.username,
      category: cred.category,
      website: cred.website,
      notes: cred.notes,
    };
  }

  if (this.ownerId && isPopulated(this.ownerId)) {
    const owner = this.ownerId as any;
    result.owner = {
      id: owner._id.toString(),
      name: owner.name,
      email: owner.email,
      employeeId: owner.employeeId,
      department: owner.department,
    };
  }

  if (this.recipientId && isPopulated(this.recipientId)) {
    const recipient = this.recipientId as any;
    result.recipient = {
      id: recipient._id.toString(),
      name: recipient.name,
      email: recipient.email,
      employeeId: recipient.employeeId,
      department: recipient.department,
    };
  }

  return result;
};

/**
 * Returns safe public metadata for external share viewing.
 * Masks email address and protects all internal storage details.
 */
CredentialShareSchema.methods.toPublicSafeMetadata = function (this: ICredentialShareDocument): PublicShareMetadata {
  const isPopulated = (doc: unknown): doc is Record<string, unknown> =>
    typeof doc === 'object' && doc !== null && '_id' in doc;

  const ownerName =
    this.ownerId && isPopulated(this.ownerId)
      ? (this.ownerId as any).name || 'A team member'
      : 'A team member';

  let emailMasked = '***';
  if (this.recipientEmail) {
    const [local, domain] = this.recipientEmail.split('@');
    if (local && domain) {
      const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
      emailMasked = `${visible}***@${domain}`;
    }
  }

  const now = new Date();
  const isExpired = this.expiresAt <= now || this.status === 'EXPIRED';
  const isRevoked = this.status === 'REVOKED';

  const itemSummary: PublicShareMetadata['itemSummary'] = {};

  if (this.resourceType === 'CREDENTIAL' && this.credentialId && isPopulated(this.credentialId)) {
    const cred = this.credentialId as any;
    itemSummary.title = cred.title;
    itemSummary.category = cred.category;
    itemSummary.website = cred.website;
  } else if (this.resourceType === 'FILE' && this.fileMetadata) {
    itemSummary.fileName = this.fileMetadata.originalName;
    itemSummary.fileSizeBytes = this.fileMetadata.sizeBytes;
    itemSummary.mimeType = this.fileMetadata.mimeType;
    itemSummary.isCompressed = this.fileMetadata.isCompressed;
    itemSummary.fileCount = this.fileMetadata.fileCount;
    itemSummary.maxDownloads = this.maxDownloads;
    itemSummary.remainingDownloads =
      typeof this.maxDownloads === 'number'
        ? Math.max(0, this.maxDownloads - (this.downloadCount || 0))
        : undefined;

    if (this.credentialId) {
      itemSummary.isCredentialProtected = true;
      if (isPopulated(this.credentialId)) {
        itemSummary.linkedCredentialTitle = (this.credentialId as any).title;
      }
    }
  }

  return {
    shareId: this._id.toString(),
    resourceType: this.resourceType,
    senderName: ownerName,
    recipientEmailMasked: emailMasked,
    expiresAt: this.expiresAt.toISOString(),
    permission: this.permission,
    isExpired,
    isRevoked,
    requiresOtp: this.recipientType === 'EXTERNAL',
    itemSummary,
  };
};

export const CredentialShareModel: Model<ICredentialShareDocument> =
  mongoose.models.CredentialShare ||
  mongoose.model<ICredentialShareDocument>('CredentialShare', CredentialShareSchema);
