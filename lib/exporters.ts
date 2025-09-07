/**
 * Enhanced export system with image downloads, ZIP bundling, and comprehensive reporting
 * Supports individual file exports and structured bundle creation
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { WixBlogPost, ExportOptions, SummaryReport } from './types.js';
import { ImageDownloader } from './image-downloader.js';
import { ReportGenerator } from './report-generator.js';
import { ZipBundler } from './zip-bundler.js';
import { 
  sanitizeFilename, 
  rewriteMarkdownImageUrls, 
  createSafePath,
  createTimestamp
} from './utils.js';
import { logger } from './logger.js';

export class PostExporter {
  private options: ExportOptions;
  private imageDownloader: ImageDownloader;

  constructor(options: ExportOptions) {
    this.options = options;
    this.imageDownloader = new ImageDownloader(options);
  }

  /**
   * Main export method that handles all formats and bundling
   */
  async exportPosts(posts: WixBlogPost[]): Promise<string[]> {
    if (this.options.bundleZip) {
      return this.exportAsBundle(posts);
    } else {
      return this.exportAsIndividualFiles(posts);
    }
  }

  /**
   * Exports as structured bundle with images, reports, and ZIP packaging
   */
  private async exportAsBundle(posts: WixBlogPost[]): Promise<string[]> {
    // Create temporary directory for bundle structure
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wix-export-'));
    const structure = ZipBundler.createBundleStructure(tempDir);

    try {
      logger.subheader('📁 Creating structured export bundle');

      // Download images first and get URL mappings
      const urlToLocalPath = await this.imageDownloader.downloadAllImages(posts, tempDir);

      // Process posts with local image paths
      const processedPosts = this.processPostsWithLocalImages(posts, urlToLocalPath);

      // Export all formats to structured directories
      await this.exportToStructuredDirectories(processedPosts, structure, urlToLocalPath);

      // Generate summary report
      const imageResults = this.imageDownloader.getDownloadResults();
      const report = ReportGenerator.generateSummaryReport(
        processedPosts,
        this.options.customer || 'unknown',
        imageResults
      );

      // Save reports
      await ReportGenerator.saveReports(tempDir, report);

      // Create ZIP bundle if requested
      const bundler = new ZipBundler(this.options);
      const zipPath = await bundler.createZipBundle(tempDir);

      return zipPath ? [zipPath] : [];

    } finally {
      // Clean up temp directory
      ZipBundler.cleanupTempDir(tempDir);
    }
  }

  /**
   * Exports as individual files (legacy behavior)
   */
  private async exportAsIndividualFiles(posts: WixBlogPost[]): Promise<string[]> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseFilename = this.options.filename || 'wix-blog-export';
    const exportedFiles: string[] = [];

    // Download images if requested
    let urlToLocalPath = new Map<string, string>();
    if (this.options.downloadImages) {
      urlToLocalPath = await this.imageDownloader.downloadAllImages(posts, this.options.outputDir);
    }

    const processedPosts = this.processPostsWithLocalImages(posts, urlToLocalPath);

    if (this.options.format === 'all' || this.options.format === 'json') {
      const filename = `${baseFilename}-${timestamp}.json`;
      await this.exportJSON(processedPosts, filename, this.options.outputDir);
      exportedFiles.push(filename);
    }

    if (this.options.format === 'all' || this.options.format === 'markdown') {
      const filename = `${baseFilename}-${timestamp}.md`;
      await this.exportMarkdown(processedPosts, filename, this.options.outputDir, urlToLocalPath);
      exportedFiles.push(filename);
    }

    if (this.options.format === 'all' || this.options.format === 'csv') {
      const filename = `${baseFilename}-${timestamp}.csv`;
      await this.exportCSV(processedPosts, filename, this.options.outputDir);
      exportedFiles.push(filename);
    }

    return exportedFiles;
  }

  /**
   * Processes posts to include local image path information
   */
  private processPostsWithLocalImages(
    posts: WixBlogPost[], 
    urlToLocalPath: Map<string, string>
  ): WixBlogPost[] {
    return posts.map(post => {
      const processedPost = { ...post };

      // Add cover image local path
      if (post.media?.wixMedia?.image?.url) {
        const localPath = urlToLocalPath.get(post.media.wixMedia.image.url);
        if (localPath) {
          processedPost.coverImageLocalPath = localPath;
        }
      }

      // Add inline image local paths
      if (post.contentText) {
        const inlineUrls = this.extractInlineImageUrls(post.contentText);
        const localPaths: string[] = [];
        
        for (const url of inlineUrls) {
          const localPath = urlToLocalPath.get(url);
          if (localPath) {
            localPaths.push(localPath);
          }
        }
        
        if (localPaths.length > 0) {
          processedPost.localImagePaths = localPaths;
        }
      }

      return processedPost;
    });
  }

  /**
   * Exports to structured bundle directories
   */
  private async exportToStructuredDirectories(
    posts: WixBlogPost[],
    structure: ReturnType<typeof ZipBundler.createBundleStructure>,
    urlToLocalPath: Map<string, string>
  ): Promise<void> {
    logger.step('Exporting to structured directories...');

    // Export individual Markdown files
    await this.exportIndividualMarkdownFiles(posts, structure.markdownDir, urlToLocalPath);

    // Export JSON
    await this.exportJSON(posts, 'posts.json', structure.jsonDir);

    // Export CSV
    await this.exportCSV(posts, 'posts.csv', structure.csvDir);
  }

  /**
   * Exports individual Markdown files (one per post)
   */
  private async exportIndividualMarkdownFiles(
    posts: WixBlogPost[],
    outputDir: string,
    urlToLocalPath: Map<string, string>
  ): Promise<void> {
    for (const post of posts) {
      const filename = `${sanitizeFilename(post.slug || post.id)}.md`;
      const filepath = createSafePath(outputDir, filename);
      
      const markdown = this.formatSinglePostAsMarkdown(post, urlToLocalPath);
      fs.writeFileSync(filepath, markdown, 'utf8');
    }
    
    logger.success(`Exported ${posts.length} individual Markdown files`);
  }

  /**
   * Formats a single post as Markdown with proper metadata and image handling
   */
  private formatSinglePostAsMarkdown(
    post: WixBlogPost, 
    urlToLocalPath: Map<string, string>
  ): string {
    let markdown = '';

    // Front matter / metadata
    markdown += `# ${post.title}\n\n`;
    
    if (post.url) {
      markdown += `**Original URL:** ${post.url}\n`;
    }
    
    markdown += `**Slug:** \`${post.slug}\`\n`;
    markdown += `**Status:** ${post.status || 'Published'}\n`;
    
    if (post.firstPublishedDate) {
      markdown += `**Published:** ${new Date(post.firstPublishedDate).toLocaleDateString()}\n`;
    }
    
    if (post.lastPublishedDate && post.lastPublishedDate !== post.firstPublishedDate) {
      markdown += `**Updated:** ${new Date(post.lastPublishedDate).toLocaleDateString()}\n`;
    }
    
    markdown += `**Reading Time:** ${post.minutesToRead} minutes\n`;
    
    if (post.featured) {
      markdown += `**Featured:** ⭐ Yes\n`;
    }
    
    if (post.hashtags && post.hashtags.length > 0) {
      markdown += `**Tags:** ${post.hashtags.map(tag => `#${tag}`).join(' ')}\n`;
    }

    if (post.categoryIds && post.categoryIds.length > 0) {
      markdown += `**Categories:** ${post.categoryIds.join(', ')}\n`;
    }

    markdown += '\n---\n\n';

    // Cover image
    if (post.media?.wixMedia?.image) {
      const imageUrl = post.media.wixMedia.image.url;
      const localPath = urlToLocalPath.get(imageUrl);
      const imagePath = localPath || imageUrl;
      const altText = post.media.wixMedia.image.altText || post.title;
      
      markdown += `![${altText}](${imagePath})\n\n`;
    }

    // Excerpt
    if (post.excerpt) {
      markdown += `## Excerpt\n\n${post.excerpt}\n\n`;
    }

    // Content with rewritten image URLs
    if (this.options.includeContent && post.contentText) {
      let content = post.contentText;
      
      if (urlToLocalPath.size > 0) {
        content = rewriteMarkdownImageUrls(content, urlToLocalPath);
      }
      
      markdown += `## Content\n\n${content}\n\n`;
    }

    return markdown;
  }

  /**
   * Enhanced JSON export with local image paths
   */
  private async exportJSON(posts: WixBlogPost[], filename: string, outputDir: string): Promise<void> {
    const filepath = createSafePath(outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(posts, null, 2), 'utf8');
    logger.success(`JSON export saved: ${filepath}`);
  }

  /**
   * Enhanced CSV export with comprehensive columns
   */
  private async exportCSV(posts: WixBlogPost[], filename: string, outputDir: string): Promise<void> {
    const headers = [
      'id',
      'slug', 
      'title',
      'status',
      'firstPublishedDate',
      'lastPublishedDate', 
      'featured',
      'url',
      'tags',
      'categoryIds',
      'readingTime',
      'coverImageUrl',
      'coverImageLocalPath',
      'contentLength',
      'excerptLength'
    ];

    if (this.options.includeContent) {
      headers.push('content');
    }

    let csv = headers.join(',') + '\n';

    posts.forEach(post => {
      const row = [
        `"${post.id}"`,
        `"${post.slug}"`,
        `"${post.title.replace(/"/g, '""')}"`,
        `"${post.status || 'PUBLISHED'}"`,
        `"${post.firstPublishedDate}"`,
        `"${post.lastPublishedDate}"`,
        `"${post.featured ? 'true' : 'false'}"`,
        `"${post.url || ''}"`,
        `"${post.hashtags?.join('|') || ''}"`,
        `"${post.categoryIds?.join('|') || ''}"`,
        `"${post.minutesToRead}"`,
        `"${post.media?.wixMedia?.image?.url || ''}"`,
        `"${post.coverImageLocalPath || ''}"`,
        `"${post.contentText?.length || 0}"`,
        `"${post.excerpt?.length || 0}"`
      ];

      if (this.options.includeContent) {
        const content = (post.contentText || '').replace(/"/g, '""').replace(/\n/g, '\\n');
        row.push(`"${content}"`);
      }

      csv += row.join(',') + '\n';
    });

    const filepath = createSafePath(outputDir, filename);
    fs.writeFileSync(filepath, csv, 'utf8');
    logger.success(`CSV export saved: ${filepath}`);
  }

  /**
   * Legacy combined Markdown export (single file with all posts)
   */
  private async exportMarkdown(
    posts: WixBlogPost[], 
    filename: string, 
    outputDir: string,
    urlToLocalPath: Map<string, string>
  ): Promise<void> {
    const categorizedPosts = this.categorizePosts(posts);
    let markdown = this.generateMarkdownHeader(categorizedPosts);

    // Generate sections for each post status
    if (categorizedPosts.published.length > 0) {
      markdown += `# 📝 Published Posts (${categorizedPosts.published.length})\n\n`;
      categorizedPosts.published.forEach(post => {
        markdown += this.formatPostAsMarkdown(post, urlToLocalPath);
      });
    }

    if (categorizedPosts.drafts.length > 0) {
      markdown += `# 📋 Draft Posts (${categorizedPosts.drafts.length})\n\n`;
      categorizedPosts.drafts.forEach(post => {
        markdown += this.formatPostAsMarkdown(post, urlToLocalPath);
      });
    }

    if (categorizedPosts.scheduled.length > 0) {
      markdown += `# 📅 Scheduled Posts (${categorizedPosts.scheduled.length})\n\n`;
      categorizedPosts.scheduled.forEach(post => {
        markdown += this.formatPostAsMarkdown(post, urlToLocalPath);
      });
    }

    const filepath = createSafePath(outputDir, filename);
    fs.writeFileSync(filepath, markdown, 'utf8');
    logger.success(`Markdown export saved: ${filepath}`);
  }

  /**
   * Categorizes posts by status for organized output
   */
  private categorizePosts(posts: WixBlogPost[]) {
    return {
      published: posts.filter(p => p.status === 'PUBLISHED' || !p.status),
      drafts: posts.filter(p => p.status === 'DRAFT'),
      scheduled: posts.filter(p => p.status === 'SCHEDULED')
    };
  }

  private generateMarkdownHeader(categorizedPosts: ReturnType<typeof this.categorizePosts>): string {
    const total = categorizedPosts.published.length + categorizedPosts.drafts.length + categorizedPosts.scheduled.length;
    
    return `# Wix Blog Export\n\n` +
           `**Export Date:** ${new Date().toISOString()}\n\n` +
           `**Summary:**\n` +
           `- 📝 Published: ${categorizedPosts.published.length}\n` +
           `- 📋 Drafts: ${categorizedPosts.drafts.length}\n` +
           `- 📅 Scheduled: ${categorizedPosts.scheduled.length}\n` +
           `- 📊 Total: ${total}\n\n` +
           `---\n\n`;
  }

  private formatPostAsMarkdown(post: WixBlogPost, urlToLocalPath: Map<string, string>): string {
    let postMd = `## ${post.title}\n\n`;
    postMd += `**Status:** ${post.status || 'Published'}\n`;
    postMd += `**Slug:** \`${post.slug}\`\n`;
    
    if (post.firstPublishedDate) {
      postMd += `**Published:** ${new Date(post.firstPublishedDate).toLocaleDateString()}\n`;
    }
    
    postMd += `**Reading Time:** ${post.minutesToRead} minutes\n`;
    
    if (post.featured) {
      postMd += `**Featured:** ⭐ Yes\n`;
    }
    
    if (post.hashtags && post.hashtags.length > 0) {
      postMd += `**Tags:** ${post.hashtags.map(tag => `#${tag}`).join(' ')}\n`;
    }
    
    if (this.options.includeImages && post.media?.wixMedia?.image) {
      const imageUrl = post.media.wixMedia.image.url;
      const localPath = urlToLocalPath.get(imageUrl);
      const imagePath = localPath || imageUrl;
      postMd += `**Cover Image:** ![${post.title}](${imagePath})\n`;
    }
    
    postMd += `\n### Excerpt\n\n${post.excerpt || 'No excerpt available'}\n\n`;
    
    if (this.options.includeContent && post.contentText) {
      let content = post.contentText;
      
      if (urlToLocalPath.size > 0) {
        content = rewriteMarkdownImageUrls(content, urlToLocalPath);
      }
      
      postMd += `### Content\n\n${content}\n\n`;
    }
    
    postMd += `---\n\n`;
    
    return postMd;
  }

  private extractInlineImageUrls(markdown: string): string[] {
    const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const urls: string[] = [];
    let match;
    
    while ((match = imageRegex.exec(markdown)) !== null) {
      const url = match[1];
      if (!url.startsWith('data:')) {
        urls.push(url);
      }
    }
    
    return Array.from(new Set(urls));
  }
}