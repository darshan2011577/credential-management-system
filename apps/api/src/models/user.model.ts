import mongoose, { Document, Model, Schema } from 'mongoose';
import { CredentialDeliveryStatus, SafeUser, UserRole, UserStatus } from '@credential-manager/types';

export interface IUserDocument extends Document {
  employeeId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  phoneNumber?: string;
  credentialDeliveryStatus?: CredentialDeliveryStatus;
  credentialsSentAt?: Date;
  registeredAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  rejectionReason?: string;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      default: '',
      select: false, // Never return passwordHash in queries by default
    },
    role: {
      type: String,
      enum: ['ADMIN', 'EMPLOYEE'],
      default: 'EMPLOYEE',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'ACTIVE', 'REJECTED', 'DISABLED', 'INACTIVE', 'SUSPENDED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    credentialDeliveryStatus: {
      type: String,
      enum: ['NOT_SENT', 'SENDING', 'SENT', 'FAILED'],
      default: 'NOT_SENT',
      required: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    credentialsSentAt: {
      type: Date,
      default: undefined,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: {
      type: Date,
      default: undefined,
    },
    approvedBy: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    lastLoginAt: {
      type: Date,
      default: undefined,
    },
    passwordChangedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        ret.id = ret._id ? (ret._id as { toString(): string }).toString() : '';
        delete ret._id;
        return ret;
      },
    },
  }
);

// Map database document to sanitized public representation
export function toPublicUser(user: IUserDocument | Record<string, any>): SafeUser {
  const raw = typeof user.toJSON === 'function' ? user.toJSON() : user;
  return {
    id: raw.id || (raw._id ? raw._id.toString() : ''),
    employeeId: raw.employeeId,
    name: raw.name,
    email: raw.email,
    role: raw.role as UserRole,
    status: raw.status as UserStatus,
    department: raw.department || undefined,
    phoneNumber: raw.phoneNumber || undefined,
    credentialDeliveryStatus: (raw.credentialDeliveryStatus as CredentialDeliveryStatus) || 'NOT_SENT',
    credentialsSentAt: raw.credentialsSentAt ? new Date(raw.credentialsSentAt).toISOString() : undefined,
    registeredAt: raw.registeredAt ? new Date(raw.registeredAt).toISOString() : (raw.createdAt ? new Date(raw.createdAt).toISOString() : undefined),
    approvedAt: raw.approvedAt ? new Date(raw.approvedAt).toISOString() : undefined,
    approvedBy: raw.approvedBy || undefined,
    rejectionReason: raw.rejectionReason || undefined,
    lastLoginAt: raw.lastLoginAt ? new Date(raw.lastLoginAt).toISOString() : undefined,
    passwordChangedAt: raw.passwordChangedAt ? new Date(raw.passwordChangedAt).toISOString() : undefined,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
  };
}

export const UserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);
