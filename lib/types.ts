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
}

export interface WixCredentials {
  apiKey: string;
  accountId: string;
  siteId: string;
}

export interface ExportOptions {
  format: 'markdown' | 'json' | 'csv' | 'all';
  includeContent: boolean;
  includeImages: boolean;
  outputDir: string;
  filename?: string;
}

export interface WixApiResponse {
  posts: WixBlogPost[];
  metaData: {
    count: number;
    offset: number;
    total: number;
  };
}