import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  AuditAction,
  AuditCategory,
  AuditResult,
  IAuditLog,
  UserRole,
} from '@credential-manager/types';
import { AUDIT_CONFIG } from '@credential-manager/config';

export interface IAuditLogDocument extends Document {
  _id: Types.ObjectId;
  actorId?: Types.ObjectId;
  actorRole: UserRole | 'SYSTEM';
  actorEmail?: string;
  actorName?: string;
  action: AuditAction;
  category: AuditCategory;
  resourceType?: string;
  resourceId?: string;
  targetUserId?: Types.ObjectId;
  result: AuditResult;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  toSafeAuditLog(): IAuditLog;
}

const AuditLogSchema = new Schema<IAuditLogDocument>(
  {
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['ADMIN', 'EMPLOYEE', 'SYSTEM'],
      required: [true, 'Actor role is required'],
      default: 'SYSTEM',
      index: true,
    },
    actorEmail: {
      type: String,
      trim: true,
      default: undefined,
    },
    actorName: {
      type: String,
      trim: true,
      default: undefined,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      index: true,
    },
    category: {
      type: String,
      enum: {
        values: AUDIT_CONFIG.categories,
        message: '{VALUE} is not a valid audit category',
      },
      required: [true, 'Audit category is required'],
      index: true,
    },
    resourceType: {
      type: String,
      trim: true,
      default: undefined,
      index: true,
    },
    resourceId: {
      type: String,
      trim: true,
      default: undefined,
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
      index: true,
    },
    result: {
      type: String,
      enum: {
        values: AUDIT_CONFIG.results,
        message: '{VALUE} is not a valid audit result',
      },
      required: [true, 'Audit result is required'],
      default: 'SUCCESS',
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: undefined,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters'],
      default: undefined,
    },
    requestId: {
      type: String,
      trim: true,
      default: undefined,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Append-only immutable log
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, any>) => {
        ret.id = ret._id ? ret._id.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// High-performance compound indexes for complex filtering and Admin timeline queries
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ category: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
AuditLogSchema.index({ result: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });
AuditLogSchema.index({ targetUserId: 1, createdAt: -1 });

AuditLogSchema.methods.toSafeAuditLog = function (): IAuditLog {
  return {
    id: this._id.toString(),
    actorId: this.actorId ? this.actorId.toString() : undefined,
    actorRole: this.actorRole,
    actorEmail: this.actorEmail,
    actorName: this.actorName,
    action: this.action,
    category: this.category,
    resourceType: this.resourceType,
    resourceId: this.resourceId,
    targetUserId: this.targetUserId ? this.targetUserId.toString() : undefined,
    result: this.result,
    ipAddress: this.ipAddress,
    userAgent: this.userAgent,
    requestId: this.requestId,
    metadata: this.metadata,
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
  };
};

export const AuditLogModel: Model<IAuditLogDocument> =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLogDocument>('AuditLog', AuditLogSchema);
