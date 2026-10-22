import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { ApiLogger } from '../../utils/logger.js';
import {
  EmailRenderOutput,
  renderLoginCredentialsEmail,
  renderSecurityAlertEmail,
  renderShareApprovedEmail,
  renderShareReceivedEmail,
  renderShareRejectedEmail,
  renderShareRevokedEmail,
  renderPasswordRequestApprovedEmail,
  renderPasswordRequestRejectedEmail,
  renderCredentialEmailShareEmail,
  renderFileEmailShareEmail,
  renderShareOtpVerificationEmail,
  renderShareResendEmail,
} from './email-templates.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  private static transporter: Transporter | null = null;
  private static cachedConfigKey: string = '';
  private static mockSentEmails: Array<SendEmailOptions & { messageId: string; sentAt: Date }> = [];
  private static mockMode: boolean = false;

  /**
   * Refreshes environment variables from disk in development to pick up live .env edits.
   */
  private static refreshEnv(): void {
    if (env.NODE_ENV === 'test') return;
    const candidateEnvPaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '../../.env'),
      path.resolve(process.cwd(), '../.env'),
      path.resolve(process.cwd(), 'apps/api/.env'),
    ];
    for (const envPath of candidateEnvPaths) {
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: true });
      }
    }
  }

  /**
   * Initializes or returns the cached Nodemailer SMTP transporter.
   */
  private static getTransporter(): Transporter {
    if (env.NODE_ENV === 'test' || this.mockMode) {
      if (!this.transporter || this.cachedConfigKey !== 'test-mock') {
        this.transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
        this.cachedConfigKey = 'test-mock';
      }
      return this.transporter;
    }

    this.refreshEnv();

    const host = (process.env.SMTP_HOST || env.SMTP_HOST || 'smtp.gmail.com').trim();
    const port = parseInt(process.env.SMTP_PORT || `${env.SMTP_PORT || 465}`, 10);
    const secure = process.env.SMTP_SECURE === 'true' || env.SMTP_SECURE || port === 465;
    const user = (process.env.SMTP_USER || env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASSWORD || env.SMTP_PASSWORD || '').replace(/\s+/g, '');

    const configKey = `${user}:${pass}:${host}:${port}:${secure}`;

    if (this.transporter && this.cachedConfigKey === configKey) {
      return this.transporter;
    }

    const isGmail =
      host === 'smtp.gmail.com' ||
      host === 'gmail' ||
      user.toLowerCase().endsWith('@gmail.com');

    if (isGmail) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user,
          pass,
        },
      });
      this.cachedConfigKey = configKey;
      return this.transporter;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: env.NODE_ENV === 'production',
      },
    });
    this.cachedConfigKey = configKey;

    return this.transporter;
  }

  /**
   * Enables or disables in-memory mock mode (useful for testing).
   */
  public static setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    this.transporter = null;
  }

  /**
   * Returns list of emails captured during mock mode.
   */
  public static getSentEmails(): Array<SendEmailOptions & { messageId: string; sentAt: Date }> {
    return [...this.mockSentEmails];
  }

  /**
   * Clears the mock emails array.
   */
  public static clearSentEmails(): void {
    this.mockSentEmails = [];
  }

  /**
   * Verifies SMTP connection health.
   */
  public static async verifyConnection(): Promise<boolean> {
    try {
      if (env.NODE_ENV === 'test' || this.mockMode) {
        return true;
      }
      const transporter = this.getTransporter();
      await transporter.verify();
      ApiLogger.info('EmailService', `SMTP transport connected successfully to ${env.SMTP_HOST}:${env.SMTP_PORT}`);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown SMTP verification error';
      ApiLogger.warn('EmailService', `SMTP verification failed: ${msg}`);
      return false;
    }
  }

  /**
   * Sends an email via Nodemailer SMTP with fail-safe error isolation.
   * Never throws uncaught exceptions to ensure business operations succeed even if SMTP is offline.
   */
  public static async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    try {
      if (!options.to || !options.to.includes('@')) {
        ApiLogger.warn('EmailService', `Skipping email dispatch: Invalid recipient address [${options.to}]`);
        return { success: false, error: 'Invalid recipient address' };
      }

      const recipientDomain = (options.to.split('@')[1] || '').toLowerCase().trim();

      // 1. Strict Blocklist: Protect real organizations used inadvertently as test domains
      const blockedDomains = ['securevault.com', 'securevault.local', 'securevault.org', 'securevault.net'];
      if (blockedDomains.includes(recipientDomain)) {
        const mockId = `blocked-securevault-${Date.now()}`;
        ApiLogger.warn(
          'EmailService',
          `[BLOCKED] Outgoing email to "${options.to}" intercepted. "securevault.com" is an active registered company domain. For dummy/test accounts, use RFC 2606 reserved domains (@example.com, @example.org).`
        );
        return { success: true, messageId: mockId };
      }

      // 2. RFC 2606 Reserved Test Domains: Safely mock without transmitting to real mail servers
      const isReservedTestDomain =
        recipientDomain === 'example.com' ||
        recipientDomain === 'example.org' ||
        recipientDomain === 'example.net' ||
        recipientDomain.endsWith('.example') ||
        recipientDomain.endsWith('.test') ||
        recipientDomain.endsWith('.localhost') ||
        recipientDomain.endsWith('.invalid') ||
        recipientDomain.endsWith('.local');

      if (isReservedTestDomain) {
        const mockId = `mock-reserved-${Date.now()}`;
        ApiLogger.info(
          'EmailService',
          `[Mock Test Domain] Email to ${options.to} safely handled locally (RFC 2606 test domain): "${options.subject}"`
        );
        return { success: true, messageId: mockId };
      }

      if (env.NODE_ENV === 'test' || this.mockMode) {
        const messageId = `mock-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        this.mockSentEmails.push({
          ...options,
          messageId,
          sentAt: new Date(),
        });
        ApiLogger.info('EmailService', `[Mock] Email dispatched to ${options.to}: "${options.subject}"`);
        return { success: true, messageId };
      }

      const transporter = this.getTransporter();
      const fromAddress = process.env.SMTP_FROM || env.SMTP_FROM;
      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      ApiLogger.info('EmailService', `Email sent successfully to ${options.to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown SMTP delivery error';
      ApiLogger.warn('EmailService', `Email delivery failed for recipient ${options.to}: ${errorMsg}`);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  // --------------------------------------------------------------------------
  // High-Level Domain Email Dispatches
  // --------------------------------------------------------------------------

  public static async sendShareRequestReceivedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    senderEmail: string;
    credentialTitle: string;
    credentialCategory: string;
    permission: string;
    expiresAt: string;
  }): Promise<SendEmailResult> {
    const rendered = renderShareReceivedEmail(params);
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendShareApprovedEmail(params: {
    ownerEmail: string;
    ownerName: string;
    recipientName: string;
    credentialTitle: string;
    permission: string;
  }): Promise<SendEmailResult> {
    const rendered = renderShareApprovedEmail(params);
    return this.sendEmail({
      to: params.ownerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendShareRejectedEmail(params: {
    ownerEmail: string;
    ownerName: string;
    recipientName: string;
    credentialTitle: string;
  }): Promise<SendEmailResult> {
    const rendered = renderShareRejectedEmail(params);
    return this.sendEmail({
      to: params.ownerEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendShareRevokedEmail(params: {
    recipientEmail: string;
    recipientName: string;
    ownerName: string;
    credentialTitle: string;
  }): Promise<SendEmailResult> {
    const rendered = renderShareRevokedEmail(params);
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendSecurityAlertEmail(params: {
    userEmail: string;
    userName: string;
    alertTitle: string;
    alertMessage: string;
  }): Promise<SendEmailResult> {
    const rendered = renderSecurityAlertEmail(params);
    return this.sendEmail({
      to: params.userEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendLoginCredentialsEmail(params: {
    recipientEmail: string;
    employeeName: string;
    temporaryPassword: string;
    applicationName?: string;
  }): Promise<SendEmailResult> {
    const rendered = renderLoginCredentialsEmail({
      recipientEmail: params.recipientEmail,
      employeeName: params.employeeName,
      temporaryPassword: params.temporaryPassword,
      applicationName: params.applicationName,
    });
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendPasswordRequestApprovedEmail(params: {
    recipientEmail: string;
    employeeName: string;
    requestType: string;
    applicationName?: string;
  }): Promise<SendEmailResult> {
    const rendered = renderPasswordRequestApprovedEmail({
      recipientEmail: params.recipientEmail,
      employeeName: params.employeeName,
      requestType: params.requestType,
      applicationName: params.applicationName,
    });
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendPasswordRequestRejectedEmail(params: {
    recipientEmail: string;
    employeeName: string;
    requestType: string;
    adminNote?: string;
    applicationName?: string;
  }): Promise<SendEmailResult> {
    const rendered = renderPasswordRequestRejectedEmail({
      recipientEmail: params.recipientEmail,
      employeeName: params.employeeName,
      requestType: params.requestType,
      adminNote: params.adminNote,
      applicationName: params.applicationName,
    });
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendCredentialEmailShare(params: {
    recipientEmail: string;
    senderName: string;
    senderEmail: string;
    credentialTitle: string;
    credentialCategory: string;
    permission: string;
    expiresAt: string;
    shareUrl: string;
  }): Promise<SendEmailResult> {
    const rendered = renderCredentialEmailShareEmail(params);
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendFileEmailShare(params: {
    recipientEmail: string;
    senderName: string;
    senderEmail: string;
    fileName: string;
    fileSizeBytes: number;
    isCompressed?: boolean;
    fileCount?: number;
    permission: string;
    expiresAt: string;
    shareUrl: string;
  }): Promise<SendEmailResult> {
    const rendered = renderFileEmailShareEmail(params);
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendShareOtpEmail(params: {
    recipientEmail: string;
    otp: string;
    ttlMinutes: number;
  }): Promise<SendEmailResult> {
    const rendered = renderShareOtpVerificationEmail(params);
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  public static async sendShareResendEmail(params: {
    recipientEmail: string;
    senderName: string;
    resourceTitle: string;
    resourceType: string;
    expiresAt: string;
    shareUrl: string;
  }): Promise<SendEmailResult> {
    const rendered = renderShareResendEmail(params);
    return this.sendEmail({
      to: params.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
}

