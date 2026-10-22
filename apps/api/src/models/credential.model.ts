import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { CredentialCategory, EncryptedData, ICredentialListItem } from '@credential-manager/types';
import { CREDENTIAL_CONFIG } from '@credential-manager/config';

export interface ICredentialDocument extends Document {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  website?: string;
  username: string;
  encryptedPassword: EncryptedData;
  category: CredentialCategory;
  notes?: string;
  favorite: boolean;
  passwordChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  toSafeCredential(): ICredentialListItem;
}

const EncryptedDataSchema = new Schema<EncryptedData>(
  {
    version: { type: Number, required: true, default: 1 },
    algorithm: { type: String, required: true, default: 'aes-256-gcm' },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false }
);

const CredentialSchema = new Schema<ICredentialDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Credential title is required'],
      trim: true,
      maxlength: [CREDENTIAL_CONFIG.maxTitleLength, `Title cannot exceed ${CREDENTIAL_CONFIG.maxTitleLength} characters`],
    },
    website: {
      type: String,
      trim: true,
      maxlength: [CREDENTIAL_CONFIG.maxWebsiteLength, `Website URL cannot exceed ${CREDENTIAL_CONFIG.maxWebsiteLength} characters`],
      default: '',
    },
    username: {
      type: String,
      required: [true, 'Username / Account ID is required'],
      trim: true,
      maxlength: [CREDENTIAL_CONFIG.maxUsernameLength, `Username cannot exceed ${CREDENTIAL_CONFIG.maxUsernameLength} characters`],
    },
    encryptedPassword: {
      type: EncryptedDataSchema,
      required: [true, 'Encrypted password payload is required'],
      select: false, // Critical Security Guarantee: Hidden by default on all queries
    },
    category: {
      type: String,
      required: [true, 'Credential category is required'],
      enum: {
        values: CREDENTIAL_CONFIG.categories,
        message: '{VALUE} is not a supported credential category',
      },
      default: 'OTHER',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [CREDENTIAL_CONFIG.maxNotesLength, `Notes cannot exceed ${CREDENTIAL_CONFIG.maxNotesLength} characters`],
      default: '',
    },
    favorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    passwordChangedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: 'credentials',
  }
);

// Compound Indexes for fast owner-filtered queries
CredentialSchema.index({ ownerId: 1, category: 1 });
CredentialSchema.index({ ownerId: 1, favorite: 1 });
CredentialSchema.index({ ownerId: 1, title: 1 });
CredentialSchema.index({ ownerId: 1, createdAt: -1 });

/**
 * Sanitizes MongoDB document into a safe frontend DTO with zero encrypted payload or password leaks.
 */
CredentialSchema.methods.toSafeCredential = function (): ICredentialListItem {
  return {
    id: this._id.toString(),
    ownerId: this.ownerId.toString(),
    title: this.title,
    website: this.website || undefined,
    username: this.username,
    category: this.category as CredentialCategory,
    notes: this.notes || undefined,
    favorite: Boolean(this.favorite),
    passwordChangedAt: (this.passwordChangedAt || this.createdAt || new Date()).toISOString(),
    createdAt: this.createdAt.toISOString(),
    updatedAt: this.updatedAt.toISOString(),
  };
};

export const CredentialModel: Model<ICredentialDocument> =
  mongoose.models.Credential || mongoose.model<ICredentialDocument>('Credential', CredentialSchema);
