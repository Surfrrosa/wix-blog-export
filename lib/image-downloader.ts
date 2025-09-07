/**
 * Image download system with concurrency control, retries, and timeout handling
 * Uses Node.js native fetch (18+) with p-limit for concurrency control
 */

import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import { 
  ImageDownloadResult, 
  WixBlogPost, 
  ExportOptions 
} from './types.js';
import { 
  sanitizeFilename, 
  generateImageHash, 
  getFileExtensionFromUrl, 
  isValidImageUrl,
  extractInlineImageUrls,
  createSafePath
} from './utils.js';
import { logger } from './logger.js';

export class ImageDownloader {
  private limit: ReturnType<typeof pLimit>;
  private options: ExportOptions;
  private downloadResults: ImageDownloadResult[] = [];

  constructor(options: ExportOptions) {
    this.options = options;
    this.limit = pLimit(options.concurrency);
  }

  /**
   * Downloads all images for a list of posts with concurrency control
   */
  async downloadAllImages(
    posts: WixBlogPost[], 
    outputDir: string
  ): Promise<Map<string, string>> {
    const urlToLocalPath = new Map<string, string>();
    
    if (!this.options.downloadImages || this.options.dryRun) {
      logger.info(`Image download skipped (downloadImages: ${this.options.downloadImages}, dryRun: ${this.options.dryRun})`);
      return urlToLocalPath;
    }

    logger.subheader('📸 Downloading images');
    
    // Create images directory
    const imagesDir = createSafePath(outputDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    // Collect all image URLs from all posts
    const imageDownloads: Array<{
      postId: string;
      postSlug: string;
      url: string;
      type: 'cover' | 'inline';
    }> = [];

    for (const post of posts) {
      const postSlug = sanitizeFilename(post.slug || post.id);
      
      // Cover image
      if (post.media?.wixMedia?.image?.url) {
        const coverUrl = post.media.wixMedia.image.url;
        if (isValidImageUrl(coverUrl)) {
          imageDownloads.push({
            postId: post.id,
            postSlug,
            url: coverUrl,
            type: 'cover'
          });
        }
      }

      // Inline images from content
      if (post.contentText) {
        const inlineUrls = extractInlineImageUrls(post.contentText);
        for (const url of inlineUrls) {
          if (isValidImageUrl(url)) {
            imageDownloads.push({
              postId: post.id,
              postSlug,
              url,
              type: 'inline'
            });
          }
        }
      }
    }

    logger.info(`Found ${imageDownloads.length} images to download across ${posts.length} posts`);

    if (imageDownloads.length === 0) {
      return urlToLocalPath;
    }

    // Download images with concurrency control
    const downloadPromises = imageDownloads.map(({ postId, postSlug, url, type }) =>
      this.limit(() => this.downloadSingleImage(postId, postSlug, url, type, imagesDir))
    );

    const results = await Promise.allSettled(downloadPromises);
    
    // Process results
    let successful = 0;
    let failed = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const downloadResult = result.value;
        this.downloadResults.push(downloadResult);
        
        if (downloadResult.success && downloadResult.localPath) {
          urlToLocalPath.set(downloadResult.originalUrl, downloadResult.localPath);
          successful++;
        } else {
          failed++;
        }
      } else {
        failed++;
        logger.warning(`Download promise rejected: ${result.reason}`);
      }
    }

    logger.success(`Image downloads complete: ${successful} successful, ${failed} failed`);
    
    return urlToLocalPath;
  }

  /**
   * Downloads a single image with retry logic and timeout
   */
  private async downloadSingleImage(
    postId: string,
    postSlug: string,
    url: string,
    type: 'cover' | 'inline',
    imagesDir: string
  ): Promise<ImageDownloadResult> {
    const result: ImageDownloadResult = {
      postId,
      originalUrl: url,
      success: false
    };

    let lastError: string = '';

    for (let attempt = 1; attempt <= this.options.retry; attempt++) {
      try {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeoutMs);

        logger.step(`Downloading ${type} image for ${postSlug} (attempt ${attempt}/${this.options.retry})`);

        // Fetch image
        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'wix-blog-export/1.0.0'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Get image content
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length === 0) {
          throw new Error('Empty response body');
        }

        // Create post-specific directory
        const postDir = createSafePath(imagesDir, postSlug);
        if (!fs.existsSync(postDir)) {
          fs.mkdirSync(postDir, { recursive: true });
        }

        // Generate filename
        const hash = generateImageHash(url, buffer);
        const extension = getFileExtensionFromUrl(url);
        const prefix = type === 'cover' ? 'cover' : 'image';
        const filename = `${prefix}-${hash}${extension}`;
        const localPath = createSafePath(postDir, filename);

        // Save image
        fs.writeFileSync(localPath, buffer);

        // Return relative path from bundle root
        const relativePath = `images/${postSlug}/${filename}`;
        
        result.success = true;
        result.localPath = relativePath;
        
        logger.info(`✅ Downloaded: ${relativePath} (${this.formatBytes(buffer.length)})`);
        
        return result;

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        
        if (attempt === this.options.retry) {
          logger.warning(`❌ Failed to download ${url} after ${this.options.retry} attempts: ${lastError}`);
        } else {
          logger.step(`Retry ${attempt}/${this.options.retry} failed: ${lastError}`);
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    result.error = lastError;
    return result;
  }

  /**
   * Gets download results for reporting
   */
  getDownloadResults(): ImageDownloadResult[] {
    return this.downloadResults;
  }

  /**
   * Gets download statistics
   */
  getDownloadStats() {
    const attempted = this.downloadResults.length;
    const successful = this.downloadResults.filter(r => r.success).length;
    const failed = attempted - successful;

    return {
      attempted,
      downloaded: successful,
      failed
    };
  }

  /**
   * Gets failed downloads for error reporting
   */
  getFailedDownloads() {
    return this.downloadResults
      .filter(r => !r.success)
      .map(r => ({
        postId: r.postId,
        url: r.originalUrl,
        error: r.error || 'Unknown error'
      }));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}