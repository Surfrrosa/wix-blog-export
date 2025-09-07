#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { URL } from 'url';

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}🔄${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n${'='.repeat(msg.length)}`),
  subheader: (msg: string) => console.log(`\n${colors.bright}${msg}${colors.reset}`)
};

interface WixBlogPost {
  id: string;
  title: string;
  excerpt: string;
  contentText?: string;
  url?: string;
  firstPublishedDate: string;
  lastPublishedDate: string;
  status?: 'PUBLISHED' | 'DRAFT' | 'SCHEDULED';
  slug: string;
  featured: boolean;
  categoryIds: string[];
  tagIds: string[];
  relatedPostIds: string[];
  membersOnly?: boolean;
  hashtags: string[];
  commentingEnabled: boolean;
  minutesToRead: number;
  viewCount?: number;
  likeCount?: number;
  language: string;
  media?: {
    wixMedia?: {
      image?: {
        url: string;
        altText?: string;
        height?: number;
        width?: number;
      };
    };
    displayed: boolean;
  };
  seoData?: any;
}

interface WixCredentials {
  apiKey: string;
  accountId: string;
  siteId: string;
}

interface ExportOptions {
  format: 'markdown' | 'json' | 'csv' | 'all';
  includeContent: boolean;
  includeImages: boolean;
  outputDir: string;
  filename?: string;
}

class WixBlogExportTool {
  private credentials?: WixCredentials;
  private baseUrl = 'https://www.wixapis.com/blog/v3';

  constructor() {
    log.header('🚀 Wix Blog Export Tool');
    log.info('Export all your Wix blog posts to multiple formats');
  }

  async run(): Promise<void> {
    try {
      await this.setupCredentials();
      await this.validateConnection();
      const options = await this.getExportOptions();
      const posts = await this.fetchAllPosts();
      await this.exportPosts(posts, options);
      log.success('Export completed successfully! 🎉');
    } catch (error) {
      log.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  private async setupCredentials(): Promise<void> {
    log.subheader('🔑 Setting up Wix API credentials');
    
    // Try to load from .env.wix file first
    const envPath = path.join(process.cwd(), '.env.wix');
    if (fs.existsSync(envPath)) {
      log.info('Found .env.wix file, loading credentials...');
      const envContent = fs.readFileSync(envPath, 'utf8');
      const env: Record<string, string> = {};
      
      envContent.split('\n').forEach(line => {
        if (line.trim() && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) {
            env[key.trim()] = value.trim();
          }
        }
      });

      if (env.WIX_API_KEY && env.WIX_ACCOUNT_ID && env.WIX_SITE_ID) {
        this.credentials = {
          apiKey: env.WIX_API_KEY,
          accountId: env.WIX_ACCOUNT_ID,
          siteId: env.WIX_SITE_ID
        };
        
        log.success('Credentials loaded from .env.wix');
        return;
      }
    }

    // Manual credential input
    log.error('Missing or incomplete .env.wix file!');
    log.info('');
    log.info('Please create a .env.wix file in your current directory with:');
    log.info('');
    log.info('WIX_API_KEY=your_api_key_here');
    log.info('WIX_ACCOUNT_ID=your_account_id_here');
    log.info('WIX_SITE_ID=your_site_id_here');
    log.info('');
    log.info('Get your API key from: https://manage.wix.com/account/api-keys');
    log.info('Find your Site ID in your dashboard URL: https://manage.wix.com/dashboard/[SITE-ID]/...');
    
    throw new Error('Please create .env.wix file with required credentials');
  }

  private async validateConnection(): Promise<void> {
    log.subheader('🔍 Validating API connection');
    
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    log.step('Testing API authentication...');
    
    try {
      const response = await this.makeRequest('/posts', { limit: 1 });
      log.success(`Connection successful! Found ${response.metaData?.total || 0} total posts`);
      
      if (response.metaData?.total === 0) {
        log.warning('No blog posts found. This could mean:');
        log.info('  • Posts are still in draft status (only published posts are returned)');
        log.info('  • Blog app is not enabled on your site');
        log.info('  • Posts are in a different site (check your Site ID)');
      }
    } catch (error) {
      log.error('Connection failed');
      
      if (error instanceof Error && error.message.includes('403')) {
        log.info('💡 Troubleshooting 403 Forbidden:');
        log.info('  • Check your API key has Blog permissions enabled');
        log.info('  • Verify your Site ID is correct (extract from dashboard URL)');
        log.info('  • Ensure Wix Blog app is installed on your site');
      } else if (error instanceof Error && error.message.includes('401')) {
        log.info('💡 Troubleshooting 401 Unauthorized:');
        log.info('  • Your API key may be invalid or expired');
        log.info('  • Generate a new API key from Wix dashboard');
      }
      
      throw error;
    }
  }

  private async getExportOptions(): Promise<ExportOptions> {
    log.subheader('📋 Export configuration');
    
    // For now, return sensible defaults
    // In a full CLI tool, you'd prompt the user for these
    const options: ExportOptions = {
      format: 'all',
      includeContent: true,
      includeImages: true,
      outputDir: process.cwd(),
      filename: 'wix-blog-export'
    };

    log.info(`Export format: ${options.format}`);
    log.info(`Include full content: ${options.includeContent ? 'Yes' : 'No'}`);
    log.info(`Include images: ${options.includeImages ? 'Yes' : 'No'}`);
    log.info(`Output directory: ${options.outputDir}`);

    return options;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    if (!this.credentials) {
      throw new Error('No credentials available');
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': this.credentials.apiKey,
        'wix-account-id': this.credentials.accountId,
        'wix-site-id': this.credentials.siteId,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Wix API Error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    return response.json();
  }

  private async fetchAllPosts(): Promise<WixBlogPost[]> {
    log.subheader('📥 Fetching blog posts');
    
    let allPosts: WixBlogPost[] = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;

    while (hasMore) {
      log.step(`Fetching batch starting at ${offset}...`);
      
      const response = await this.makeRequest('/posts', {
        limit,
        offset,
        fieldsets: ['FULL'],
        sort: 'CREATED_DATE_DESC',
        // Include all statuses to catch drafts/scheduled posts if available
        status: ['PUBLISHED', 'DRAFT', 'SCHEDULED']
      });

      allPosts.push(...response.posts);
      
      log.info(`Got ${response.posts.length} posts (${allPosts.length}/${response.metaData.total} total)`);
      
      offset += limit;
      hasMore = offset < response.metaData.total;
      
      // Rate limiting - be nice to Wix API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    log.success(`Successfully fetched ${allPosts.length} blog posts!`);
    return allPosts;
  }

  private async exportPosts(posts: WixBlogPost[], options: ExportOptions): Promise<void> {
    log.subheader('💾 Exporting posts');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseFilename = options.filename || 'wix-blog-export';

    if (options.format === 'all' || options.format === 'json') {
      await this.exportJSON(posts, options, `${baseFilename}-${timestamp}.json`);
    }

    if (options.format === 'all' || options.format === 'markdown') {
      await this.exportMarkdown(posts, options, `${baseFilename}-${timestamp}.md`);
    }

    if (options.format === 'all' || options.format === 'csv') {
      await this.exportCSV(posts, options, `${baseFilename}-${timestamp}.csv`);
    }
  }

  private async exportJSON(posts: WixBlogPost[], options: ExportOptions, filename: string): Promise<void> {
    const filepath = path.join(options.outputDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(posts, null, 2), 'utf8');
    log.success(`JSON export saved: ${filepath}`);
  }

  private async exportMarkdown(posts: WixBlogPost[], options: ExportOptions, filename: string): Promise<void> {
    const published = posts.filter(p => p.status === 'PUBLISHED' || !p.status);
    const drafts = posts.filter(p => p.status === 'DRAFT');
    const scheduled = posts.filter(p => p.status === 'SCHEDULED');

    let markdown = '';
    
    // Header
    markdown += `# Wix Blog Export\n\n`;
    markdown += `**Export Date:** ${new Date().toISOString()}\n\n`;
    markdown += `**Summary:**\n`;
    markdown += `- 📝 Published: ${published.length}\n`;
    markdown += `- 📋 Drafts: ${drafts.length}\n`;
    markdown += `- 📅 Scheduled: ${scheduled.length}\n`;
    markdown += `- 📊 Total: ${posts.length}\n\n`;
    markdown += `---\n\n`;

    const formatPost = (post: WixBlogPost) => {
      let postMd = '';
      
      postMd += `## ${post.title}\n\n`;
      postMd += `**Status:** ${post.status || 'Published'}\n`;
      postMd += `**Slug:** \`${post.slug}\`\n`;
      
      if (post.firstPublishedDate) {
        postMd += `**Published:** ${new Date(post.firstPublishedDate).toLocaleDateString()}\n`;
      }
      
      postMd += `**Reading Time:** ${post.minutesToRead} minutes\n`;
      
      if (post.featured) postMd += `**Featured:** ⭐ Yes\n`;
      
      if (post.hashtags && post.hashtags.length > 0) {
        postMd += `**Tags:** ${post.hashtags.map(tag => `#${tag}`).join(' ')}\n`;
      }
      
      if (post.media?.wixMedia?.image) {
        postMd += `**Cover Image:** ![${post.title}](${post.media.wixMedia.image.url})\n`;
      }
      
      postMd += `\n### Excerpt\n\n${post.excerpt || 'No excerpt available'}\n\n`;
      
      if (options.includeContent && post.contentText) {
        postMd += `### Content\n\n${post.contentText}\n\n`;
      }
      
      postMd += `---\n\n`;
      
      return postMd;
    };

    // Add posts by status
    if (published.length > 0) {
      markdown += `# 📝 Published Posts (${published.length})\n\n`;
      published.forEach(post => {
        markdown += formatPost(post);
      });
    }

    if (drafts.length > 0) {
      markdown += `# 📋 Draft Posts (${drafts.length})\n\n`;
      drafts.forEach(post => {
        markdown += formatPost(post);
      });
    }

    if (scheduled.length > 0) {
      markdown += `# 📅 Scheduled Posts (${scheduled.length})\n\n`;
      scheduled.forEach(post => {
        markdown += formatPost(post);
      });
    }

    const filepath = path.join(options.outputDir, filename);
    fs.writeFileSync(filepath, markdown, 'utf8');
    log.success(`Markdown export saved: ${filepath}`);
  }

  private async exportCSV(posts: WixBlogPost[], options: ExportOptions, filename: string): Promise<void> {
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

    if (options.includeContent) {
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

      if (options.includeContent) {
        row.push(`"${(post.contentText || '').replace(/"/g, '""')}"`);
      }

      csv += row.join(',') + '\n';
    });

    const filepath = path.join(options.outputDir, filename);
    fs.writeFileSync(filepath, csv, 'utf8');
    log.success(`CSV export saved: ${filepath}`);
  }
}

// CLI interface
async function main() {
  const tool = new WixBlogExportTool();
  await tool.run();
}

// Only run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { WixBlogExportTool };