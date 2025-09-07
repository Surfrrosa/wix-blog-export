/**
 * Utility functions for filename sanitization, image handling, and path operations
 */

import crypto from 'crypto';
import path from 'path';

/**
 * Sanitizes filename/slug by replacing whitespace with dashes and removing invalid characters
 * Collapses multiple dashes and ensures result is safe for filesystem
 */
export function sanitizeFilename(input: string): string {
  return input
    .toLowerCase()
    .replace(/\s+/g, '-')                    // Replace whitespace with dashes
    .replace(/[^a-z0-9\-_.]/g, '')           // Keep only alphanumeric, dash, underscore, dot
    .replace(/-+/g, '-')                     // Collapse multiple dashes
    .replace(/^-+|-+$/g, '');                // Remove leading/trailing dashes
}

/**
 * Sanitizes customer name for use in folder/zip names
 */
export function sanitizeCustomerSlug(customer: string): string {
  const sanitized = sanitizeFilename(customer);
  return sanitized || 'unknown';
}

/**
 * Generates a content-based hash for image filenames to avoid duplicates
 */
export function generateImageHash(url: string, content?: Buffer): string {
  if (content) {
    return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
  }
  // Fallback to URL hash if no content available
  return crypto.createHash('md5').update(url).digest('hex').substring(0, 8);
}

/**
 * Extracts file extension from URL, handling query parameters
 */
export function getFileExtensionFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const ext = path.extname(pathname).toLowerCase();
    
    // Common image extensions
    const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
    if (validExts.includes(ext)) {
      return ext;
    }
    
    // Default to .jpg if no valid extension found
    return '.jpg';
  } catch {
    return '.jpg';
  }
}

/**
 * Extracts inline image URLs from Markdown content
 * Matches ![alt](url) pattern and returns array of URLs
 */
export function extractInlineImageUrls(markdown: string): string[] {
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const urls: string[] = [];
  let match;
  
  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[1];
    // Skip data URLs
    if (!url.startsWith('data:')) {
      urls.push(url);
    }
  }
  
  return Array.from(new Set(urls)); // Remove duplicates
}

/**
 * Rewrites Markdown image URLs to local relative paths
 * Maintains alt text while updating the URL
 */
export function rewriteMarkdownImageUrls(
  markdown: string, 
  urlToLocalPath: Map<string, string>
): string {
  const imageRegex = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  
  return markdown.replace(imageRegex, (match, altText, url) => {
    const localPath = urlToLocalPath.get(url);
    if (localPath) {
      return `![${altText}](${localPath})`;
    }
    return match; // Keep original if no local path found
  });
}

/**
 * Creates a unique timestamp string for filenames (UTC)
 */
export function createTimestamp(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hour = String(now.getUTCHours()).padStart(2, '0');
  const minute = String(now.getUTCMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}-${hour}${minute}`;
}

/**
 * Validates and normalizes image URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Creates a safe directory path by joining and normalizing
 */
export function createSafePath(...parts: string[]): string {
  return path.normalize(path.join(...parts));
}

/**
 * Formats byte size for human reading
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}