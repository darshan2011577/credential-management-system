import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { FILE_SHARE_CONFIG } from '@credential-manager/config';
import { IFileMetadata } from '@credential-manager/types';
import { AppError } from '../utils/errors.js';
import { ApiLogger } from '../utils/logger.js';

const require = createRequire(import.meta.url);
const archiverModule = require('archiver');
const archiver = typeof archiverModule === 'function' ? archiverModule : archiverModule.default || archiverModule;




export interface UploadedFileDto {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer?: Buffer;
}

export class FileStorageService {
  private static storageDirectory = path.resolve(process.cwd(), FILE_SHARE_CONFIG.storagePath);

  /**
   * Ensures the storage directory exists on the server.
   */
  public static ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storageDirectory)) {
      fs.mkdirSync(this.storageDirectory, { recursive: true, mode: 0o700 });
      ApiLogger.info('FileStorageService', `Created secure shared files storage directory at ${this.storageDirectory}`);
    }
  }

  /**
   * Sanitizes a client-provided filename to prevent path traversal and unsafe characters.
   */
  public static sanitizeFilename(filename: string): string {
    const base = path.basename(filename);
    // Replace non-alphanumeric (except standard dots, dashes, underscores) with underscore
    const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return cleaned.slice(0, 150) || 'shared_file';
  }

  /**
   * Validates file size, total batch size, and file extensions against centralized config.
   */
  public static validateUploadedFiles(files: Express.Multer.File[]): void {
    if (!files || files.length === 0) {
      throw AppError.badRequest('No files were provided for sharing.');
    }

    if (files.length > FILE_SHARE_CONFIG.maxFilesCount) {
      throw AppError.badRequest(`You can share a maximum of ${FILE_SHARE_CONFIG.maxFilesCount} files at once.`);
    }

    const maxFileSize = FILE_SHARE_CONFIG.maxFileSizeMB * 1024 * 1024;
    const maxBatchSize = FILE_SHARE_CONFIG.maxBatchSizeMB * 1024 * 1024;

    let totalSize = 0;

    for (const file of files) {
      totalSize += file.size;

      if (file.size > maxFileSize) {
        throw AppError.badRequest(
          `File "${file.originalname}" exceeds the maximum allowed size of ${FILE_SHARE_CONFIG.maxFileSizeMB} MB.`
        );
      }

      // Validate file extension
      const ext = path.extname(file.originalname).replace('.', '').toLowerCase();
      if (!FILE_SHARE_CONFIG.allowedExtensions.includes(ext as any)) {
        throw AppError.badRequest(
          `File "${file.originalname}" has an unpermitted file type (.${ext}). Allowed types: ${FILE_SHARE_CONFIG.allowedExtensions.join(', ')}`
        );
      }
    }

    if (totalSize > maxBatchSize) {
      throw AppError.badRequest(
        `Total batch size (${(totalSize / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${FILE_SHARE_CONFIG.maxBatchSizeMB} MB.`
      );
    }
  }

  /**
   * Processes uploaded files: if single file & compression not forced, saves directly;
   * if multiple files or compress is requested, packages them into a secure ZIP archive.
   */
  public static async processAndStoreFiles(
    files: Express.Multer.File[],
    forceCompress: boolean = false
  ): Promise<IFileMetadata> {
    this.ensureStorageDirectory();
    this.validateUploadedFiles(files);

    const shouldCompress = forceCompress || files.length > 1;

    if (!shouldCompress && files.length === 1) {
      const file = files[0];
      const safeName = this.sanitizeFilename(file.originalname);
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      const storedFilename = `${uniqueSuffix}-${safeName}`;
      const targetPath = path.join(this.storageDirectory, storedFilename);

      if (file.buffer) {
        await fs.promises.writeFile(targetPath, file.buffer, { mode: 0o600 });
      } else if (file.path) {
        await fs.promises.copyFile(file.path, targetPath);
        // Clean temporary multer upload file
        fs.unlink(file.path, () => {});
      }

      const stats = await fs.promises.stat(targetPath);

      return {
        originalName: file.originalname,
        storedFilename,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: stats.size,
        isCompressed: false,
        fileCount: 1,
        filesList: [
          {
            originalName: file.originalname,
            sizeBytes: stats.size,
            mimeType: file.mimetype || 'application/octet-stream',
          },
        ],
      };
    }

    // Multiple files or compression requested: create ZIP package
    const firstBaseName = path.parse(this.sanitizeFilename(files[0].originalname)).name;
    const zipPackageName = files.length > 1 ? `${firstBaseName}_and_${files.length - 1}_more.zip` : `${firstBaseName}_archive.zip`;
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const storedZipFilename = `${uniqueSuffix}-${zipPackageName}`;
    const zipTargetPath = path.join(this.storageDirectory, storedZipFilename);

    await this.createZipArchive(files, zipTargetPath);

    const zipStats = await fs.promises.stat(zipTargetPath);

    const filesList = files.map((f) => ({
      originalName: f.originalname,
      sizeBytes: f.size,
      mimeType: f.mimetype || 'application/octet-stream',
    }));

    return {
      originalName: zipPackageName,
      storedFilename: storedZipFilename,
      mimeType: 'application/zip',
      sizeBytes: zipStats.size,
      isCompressed: true,
      fileCount: files.length,
      filesList,
    };
  }

  /**
   * Helper to create an archiver ZIP instance safely across module formats.
   */
  private static createZip(options?: any): any {
    if (typeof archiver === 'function') {
      return archiver('zip', options);
    }
    if (typeof archiverModule === 'function') {
      return archiverModule('zip', options);
    }
    if (archiverModule && typeof archiverModule.default === 'function') {
      return archiverModule.default('zip', options);
    }
    if (archiverModule && archiverModule.ZipArchive) {
      return new archiverModule.ZipArchive(options);
    }
    if (archiverModule && archiverModule.Archiver) {
      return new archiverModule.Archiver(options);
    }
    throw new AppError(500, 'COMPRESSION_FAILED', 'Unable to instantiate zip archiver');
  }

  /**
   * Streams files into a ZIP archive safely.
   */
  private static createZipArchive(files: Express.Multer.File[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath, { mode: 0o600 });
      const archive = FileStorageService.createZip({
        zlib: { level: 9 }, // Best compression
      });

      output.on('close', () => {
        // Clean up temporary files if multer stored them on disk
        for (const file of files) {
          if (file.path && fs.existsSync(file.path)) {
            fs.unlink(file.path, () => {});
          }
        }
        resolve();
      });

      archive.on('error', (err: any) => {
        reject(new AppError(500, 'COMPRESSION_FAILED', `Failed to create compressed package: ${err.message}`));
      });

      archive.pipe(output);

      for (const file of files) {
        const safeEntryName = FileStorageService.sanitizeFilename(file.originalname);
        if (file.buffer) {
          archive.append(file.buffer, { name: safeEntryName });
        } else if (file.path) {
          archive.file(file.path, { name: safeEntryName });
        }
      }

      archive.finalize();
    });
  }

  /**
   * Resolves absolute path to a stored file with path-traversal prevention.
   */
  public static getSecureFilePath(storedFilename: string): string {
    const safeName = path.basename(storedFilename);
    const resolvedPath = path.resolve(this.storageDirectory, safeName);

    // Verify resolved path stays within the intended storage directory
    if (!resolvedPath.startsWith(this.storageDirectory)) {
      throw AppError.forbidden('Invalid file path request.');
    }

    if (!fs.existsSync(resolvedPath)) {
      throw AppError.notFound('Shared file could not be found on storage.');
    }

    return resolvedPath;
  }

  /**
   * Safely deletes a stored file when revoked or purged.
   */
  public static async deleteStoredFile(storedFilename?: string): Promise<void> {
    if (!storedFilename) return;
    try {
      const filePath = this.getSecureFilePath(storedFilename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        ApiLogger.info('FileStorageService', `Deleted stored file: ${storedFilename}`);
      }
    } catch (err) {
      ApiLogger.warn('FileStorageService', `Could not delete file ${storedFilename}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
