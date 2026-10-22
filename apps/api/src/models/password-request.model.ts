import mongoose, { Document, Model, Schema } from 'mongoose';
import { PasswordRequestType, PasswordRequestStatus } from '@credential-manager/types';

export interface IPasswordRequestDocument extends Document {
  userId: mongoose.Types.ObjectId;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  requestType: PasswordRequestType;
  newPasswordHash: string;
  status: PasswordRequestStatus;
  reason?: string;
  requestedAt: Date;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: Date;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordRequestSchema = new Schema<IPasswordRequestDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    employeeId: {
      type: String,
      required: [true, 'Employee ID is required'],
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
      lowercase: true,
      trim: true,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: '',
    },
    requestType: {
      type: String,
      enum: ['PASSWORD_CHANGE', 'FORGOT_PASSWORD'],
      required: true,
      index: true,
    },
    newPasswordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never return password hash in regular queries
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: '',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedBy: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedByName: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedAt: {
      type: Date,
      default: undefined,
    },
    adminNote: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        delete ret.newPasswordHash;
        return ret;
      },
    },
  }
);

PasswordRequestSchema.index({ status: 1, requestedAt: -1 });
PasswordRequestSchema.index({ userId: 1, status: 1 });

export const PasswordRequestModel: Model<IPasswordRequestDocument> =
  mongoose.models.PasswordRequest ||
  mongoose.model<IPasswordRequestDocument>('PasswordRequest', PasswordRequestSchema);
