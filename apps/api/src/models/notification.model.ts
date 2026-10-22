import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import {
  INotification,
  NotificationRelatedEntityType,
  NotificationType,
} from '@credential-manager/types';

export interface INotificationDocument extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: NotificationRelatedEntityType;
  relatedEntityId?: Types.ObjectId;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  toSafeNotification(): INotification;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient user reference is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: [
          'SHARE_REQUEST_RECEIVED',
          'SHARE_REQUEST_APPROVED',
          'SHARE_REQUEST_REJECTED',
          'SHARE_REVOKED',
          'SHARED_CREDENTIAL_REVEALED',
          'SECURITY_ALERT',
          'REGISTRATION_PENDING',
          'REGISTRATION_APPROVED',
          'CREDENTIALS_DELIVERED',
        ],
        message: '{VALUE} is not a valid notification type',
      },
      required: [true, 'Notification type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
      maxlength: [200, 'Notification title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
      maxlength: [1000, 'Notification message cannot exceed 1000 characters'],
    },
    relatedEntityType: {
      type: String,
      enum: ['CredentialShare', 'Credential', 'User', 'Security'],
      default: undefined,
    },
    relatedEntityId: {
      type: Schema.Types.ObjectId,
      default: undefined,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
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

// High-performance compound indexes for user feed and unread count queries
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });

NotificationSchema.methods.toSafeNotification = function (): INotification {
  return {
    id: this._id.toString(),
    recipientId: this.recipientId ? this.recipientId.toString() : '',
    type: this.type,
    title: this.title,
    message: this.message,
    relatedEntityType: this.relatedEntityType,
    relatedEntityId: this.relatedEntityId ? this.relatedEntityId.toString() : undefined,
    isRead: Boolean(this.isRead),
    readAt: this.readAt ? this.readAt.toISOString() : undefined,
    createdAt: this.createdAt ? this.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: this.updatedAt ? this.updatedAt.toISOString() : new Date().toISOString(),
  };
};

export const NotificationModel: Model<INotificationDocument> =
  mongoose.models.Notification ||
  mongoose.model<INotificationDocument>('Notification', NotificationSchema);
