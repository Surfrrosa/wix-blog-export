/**
 * ZIP bundling functionality using archiver
 * Creates structured ZIP files with proper naming and organization
 */

import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { ExportOptions } from './types.js';
import { sanitizeCustomerSlug, createTimestamp, createSafePath } from './utils.js';
import { logger } from './logger.js';

export class ZipBundler {
  private options: ExportOptions;

  constructor(options: ExportOptions) {
    this.options = options;
  }

  /**
   * Creates a ZIP bundle from the export directory
   */
  async createZipBundle(tempDir: string): Promise<string> {
    if (!this.options.bundleZip) {
      logger.info('ZIP bundling disabled');
      return '';
    }

    logger.subheader('📦 Creating ZIP bundle');

    const customerSlug = sanitizeCustomerSlug(this.options.customer || 'unknown');
    const timestamp = createTimestamp();
    const bundleTitle = this.options.bundleTitle || `wix-export-${customerSlug}`;
    const zipFilename = `${bundleTitle}-${timestamp}.zip`;
    const zipPath = createSafePath(this.options.outputDir, zipFilename);

    // Ensure output directory exists
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    logger.step(`Creating ZIP: ${zipFilename}`);

    return new Promise((resolve, reject) => {
      // Create write stream
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      // Handle stream events
      output.on('close', () => {
        const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        logger.success(`ZIP created: ${zipFilename} (${sizeMB} MB)`);
        resolve(zipPath);
      });

      output.on('end', () => {
        logger.info('ZIP stream ended');
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          logger.warning(`ZIP warning: ${err.message}`);
        } else {
          reject(err);
        }
      });

      archive.on('error', (err) => {
        logger.error(`ZIP error: ${err.message}`);
        reject(err);
      });

      // Pipe archive data to file
      archive.pipe(output);

      // Create the bundle folder structure inside the ZIP
      const bundleFolderName = `${bundleTitle}-${timestamp}`;

      // Add all files from temp directory to ZIP under the bundle folder
      this.addDirectoryToArchive(archive, tempDir, bundleFolderName);

      // Finalize the archive
      archive.finalize();
    });
  }

  /**
   * Recursively adds a directory to the archive with proper structure
   */
  private addDirectoryToArchive(
    archive: archiver.Archiver,
    sourceDir: string,
    archivePath: string
  ): void {
    if (!fs.existsSync(sourceDir)) {
      logger.warning(`Source directory does not exist: ${sourceDir}`);
      return;
    }

    const items = fs.readdirSync(sourceDir);

    for (const item of items) {
      const sourcePath = createSafePath(sourceDir, item);
      const archiveEntryPath = `${archivePath}/${item}`;
      const stats = fs.statSync(sourcePath);

      if (stats.isDirectory()) {
        // Recursively add subdirectory
        this.addDirectoryToArchive(archive, sourcePath, archiveEntryPath);
      } else if (stats.isFile()) {
        // Add file to archive
        archive.file(sourcePath, { name: archiveEntryPath });
        
        if (stats.size > 10 * 1024 * 1024) { // Log large files (>10MB)
          logger.info(`Adding large file: ${item} (${this.formatBytes(stats.size)})`);
        }
      }
    }
  }

  /**
   * Creates the structured directory layout for bundling
   */
  static createBundleStructure(baseDir: string): {
    postsDir: string;
    markdownDir: string;
    csvDir: string;
    jsonDir: string;
    imagesDir: string;
    reportsDir: string;
  } {
    const structure = {
      postsDir: createSafePath(baseDir, 'posts'),
      markdownDir: createSafePath(baseDir, 'posts', 'markdown'),
      csvDir: createSafePath(baseDir, 'posts', 'csv'),
      jsonDir: createSafePath(baseDir, 'posts', 'json'),
      imagesDir: createSafePath(baseDir, 'images'),
      reportsDir: createSafePath(baseDir, 'reports')
    };

    // Create all directories
    Object.values(structure).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    return structure;
  }

  /**
   * Gets the expected ZIP filename without creating it
   */
  getZipFilename(): string {
    if (!this.options.bundleZip) {
      return '';
    }

    const customerSlug = sanitizeCustomerSlug(this.options.customer || 'unknown');
    const timestamp = createTimestamp();
    const bundleTitle = this.options.bundleTitle || `wix-export-${customerSlug}`;
    
    return `${bundleTitle}-${timestamp}.zip`;
  }

  /**
   * Cleans up temporary directory after bundling
   */
  static cleanupTempDir(tempDir: string): void {
    if (fs.existsSync(tempDir)) {
      logger.step('Cleaning up temporary files...');
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}