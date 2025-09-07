/**
 * TypeScript interfaces for Wix Blog API responses and internal data structures
 */

export interface WixBlogPost {
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
  // Extended fields for local processing
  localImagePaths?: string[];
  coverImageLocalPath?: string;
}

export interface WixCredentials {
  apiKey: string;
  accountId: string;
  siteId: string;
}

export type ExportFormat = 'markdown' | 'json' | 'csv' | 'all';

export interface ExportOptions {
  format: ExportFormat;
  includeContent: boolean;
  includeImages: boolean;        // existing toggle to include image refs
  downloadImages: boolean;       // NEW: actually fetch images
  outputDir: string;
  filename?: string;
  customer?: string;
  bundleTitle?: string;
  bundleZip: boolean;
  concurrency: number;
  retry: number;
  timeoutMs: number;
  dryRun: boolean;
}

export interface WixApiResponse {
  posts: WixBlogPost[];
  metaData: {
    count: number;
    offset: number;
    total: number;
  };
}

export interface ImageDownloadResult {
  postId: string;
  originalUrl: string;
  localPath?: string;
  success: boolean;
  error?: string;
}

export interface SummaryReport {
  generatedAt: string;
  customer: string;
  counts: {
    total: number;
    published: number;
    draft: number;
    scheduled: number;
  };
  images: {
    attempted: number;
    downloaded: number;
    failed: number;
  };
  tagsTop10: Array<{ tag: string; count: number }>;
  byYear: Array<{ year: number; count: number }>;
  failures: {
    imageDownloads: Array<{
      postId: string;
      url: string;
      error: string;
    }>;
  };
}