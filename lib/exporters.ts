/**
 * Export formatters for different output formats
 * Each exporter is responsible for one format to maintain separation of concerns
 */

import fs from 'fs';
import path from 'path';
import { WixBlogPost, ExportOptions } from './types.js';
import { logger } from './logger.js';

export class PostExporter {
  private options: ExportOptions;

  constructor(options: ExportOptions) {
    this.options = options;
  }

  async exportPosts(posts: WixBlogPost[]): Promise<string[]> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseFilename = this.options.filename || 'wix-blog-export';
    const exportedFiles: string[] = [];

    if (this.options.format === 'all' || this.options.format === 'json') {
      const filename = `${baseFilename}-${timestamp}.json`;
      await this.exportJSON(posts, filename);
      exportedFiles.push(filename);
    }

    if (this.options.format === 'all' || this.options.format === 'markdown') {
      const filename = `${baseFilename}-${timestamp}.md`;
      await this.exportMarkdown(posts, filename);
      exportedFiles.push(filename);
    }

    if (this.options.format === 'all' || this.options.format === 'csv') {
      const filename = `${baseFilename}-${timestamp}.csv`;
      await this.exportCSV(posts, filename);
      exportedFiles.push(filename);
    }

    return exportedFiles;
  }

  private async exportJSON(posts: WixBlogPost[], filename: string): Promise<void> {
    const filepath = path.join(this.options.outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(posts, null, 2), 'utf8');
    logger.success(`JSON export saved: ${filepath}`);
  }

  private async exportMarkdown(posts: WixBlogPost[], filename: string): Promise<void> {
    const categorizedPosts = this.categorizePosts(posts);
    let markdown = this.generateMarkdownHeader(categorizedPosts);

    // Generate sections for each post status
    if (categorizedPosts.published.length > 0) {
      markdown += `# 📝 Published Posts (${categorizedPosts.published.length})\n\n`;
      categorizedPosts.published.forEach(post => {
        markdown += this.formatPostAsMarkdown(post);
      });
    }

    if (categorizedPosts.drafts.length > 0) {
      markdown += `# 📋 Draft Posts (${categorizedPosts.drafts.length})\n\n`;
      categorizedPosts.drafts.forEach(post => {
        markdown += this.formatPostAsMarkdown(post);
      });
    }

    if (categorizedPosts.scheduled.length > 0) {
      markdown += `# 📅 Scheduled Posts (${categorizedPosts.scheduled.length})\n\n`;
      categorizedPosts.scheduled.forEach(post => {
        markdown += this.formatPostAsMarkdown(post);
      });
    }

    const filepath = path.join(this.options.outputDir, filename);
    fs.writeFileSync(filepath, markdown, 'utf8');
    logger.success(`Markdown export saved: ${filepath}`);
  }

  private async exportCSV(posts: WixBlogPost[], filename: string): Promise<void> {
    const headers = [
      'Title',
      'Slug',
      'Status',
      'Published Date',
      'Reading Time',
      'Featured',
      'Tags',
      'Image URL',
      'Excerpt'
    ];

    if (this.options.includeContent) {
      headers.push('Content');
    }

    let csv = headers.join(',') + '\n';

    posts.forEach(post => {
      const row = [
        `"${post.title.replace(/"/g, '""')}"`,
        `"${post.slug}"`,
        `"${post.status || 'Published'}"`,
        `"${post.firstPublishedDate ? new Date(post.firstPublishedDate).toLocaleDateString() : ''}"`,
        `"${post.minutesToRead}"`,
        `"${post.featured ? 'Yes' : 'No'}"`,
        `"${post.hashtags.join(', ')}"`,
        `"${post.media?.wixMedia?.image?.url || ''}"`,
        `"${(post.excerpt || '').replace(/"/g, '""')}"`
      ];

      if (this.options.includeContent) {
        row.push(`"${(post.contentText || '').replace(/"/g, '""')}"`);
      }

      csv += row.join(',') + '\n';
    });

    const filepath = path.join(this.options.outputDir, filename);
    fs.writeFileSync(filepath, csv, 'utf8');
    logger.success(`CSV export saved: ${filepath}`);
  }

  /**
   * Categorizes posts by status for organized output
   * Handles edge case where status might be undefined (defaults to published)
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

  private formatPostAsMarkdown(post: WixBlogPost): string {
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
      postMd += `**Cover Image:** ![${post.title}](${post.media.wixMedia.image.url})\n`;
    }
    
    postMd += `\n### Excerpt\n\n${post.excerpt || 'No excerpt available'}\n\n`;
    
    if (this.options.includeContent && post.contentText) {
      postMd += `### Content\n\n${post.contentText}\n\n`;
    }
    
    postMd += `---\n\n`;
    
    return postMd;
  }
}