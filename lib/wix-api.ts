/**
 * Wix Blog API client with error handling and rate limiting
 * Handles authentication, pagination, and API quirks discovered during development
 */

import { URL } from 'url';
import { WixCredentials, WixBlogPost, WixApiResponse } from './types.js';
import { logger } from './logger.js';

export class WixApiClient {
  private credentials: WixCredentials;
  private baseUrl = 'https://www.wixapis.com/blog/v3';

  constructor(credentials: WixCredentials) {
    this.credentials = credentials;
  }

  /**
   * Validates API connection with helpful error diagnostics
   * Critical: Site ID is required even though not documented clearly
   */
  async validateConnection(): Promise<number> {
    logger.step('Testing API authentication...');
    
    try {
      const response = await this.makeRequest('/posts', { limit: 1 });
      const totalPosts = response.metaData?.total || 0;
      
      logger.success(`Connection successful! Found ${totalPosts} total posts`);
      
      if (totalPosts === 0) {
        logger.warning('No blog posts found. This could mean:');
        logger.info('  • Posts are still in draft status (only published posts are returned)');
        logger.info('  • Blog app is not enabled on your site');
        logger.info('  • Posts are in a different site (check your Site ID)');
      }
      
      return totalPosts;
    } catch (error) {
      this.handleApiError(error);
      throw error;
    }
  }

  /**
   * Fetches all blog posts with pagination and rate limiting
   * Discovered: API returns different statuses than documented
   */
  async fetchAllPosts(): Promise<WixBlogPost[]> {
    let allPosts: WixBlogPost[] = [];
    let offset = 0;
    const limit = 100; // Wix API maximum per request
    let hasMore = true;

    while (hasMore) {
      logger.step(`Fetching batch starting at ${offset}...`);
      
      const response = await this.makeRequest('/posts', {
        limit,
        offset,
        fieldsets: ['FULL'], // Required for complete post content
        sort: 'CREATED_DATE_DESC',
        // Include all possible statuses - API behavior discovered through testing
        status: ['PUBLISHED', 'DRAFT', 'SCHEDULED']
      });

      allPosts.push(...response.posts);
      
      logger.info(`Got ${response.posts.length} posts (${allPosts.length}/${response.metaData.total} total)`);
      
      offset += limit;
      hasMore = offset < response.metaData.total;
      
      // Rate limiting to be respectful to Wix API
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return allPosts;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<WixApiResponse> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters (arrays need special handling)
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
        'wix-site-id': this.credentials.siteId, // Critical: discovered through extensive testing
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new WixApiError(response.status, response.statusText, errorText);
    }

    return response.json();
  }

  private handleApiError(error: unknown): void {
    logger.error('API connection failed');
    
    if (error instanceof WixApiError) {
      if (error.status === 403) {
        logger.info('💡 Troubleshooting 403 Forbidden:');
        logger.info('  • Check your API key has Blog permissions enabled');
        logger.info('  • Verify your Site ID is correct (extract from dashboard URL)');
        logger.info('  • Ensure Wix Blog app is installed on your site');
      } else if (error.status === 401) {
        logger.info('💡 Troubleshooting 401 Unauthorized:');
        logger.info('  • Your API key may be invalid or expired');
        logger.info('  • Generate a new API key from Wix dashboard');
      }
    }
  }
}

export class WixApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public responseText: string
  ) {
    super(`Wix API Error: ${status} ${statusText}\n${responseText}`);
    this.name = 'WixApiError';
  }
}