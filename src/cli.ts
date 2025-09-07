#!/usr/bin/env node

/**
 * CLI entry point for Wix Blog Export Tool
 * Orchestrates the export process with proper error handling
 */

import { loadCredentials, CredentialsError } from '../lib/credentials.js';
import { WixApiClient } from '../lib/wix-api.js';
import { PostExporter } from '../lib/exporters.js';
import { ExportOptions } from '../lib/types.js';
import { logger } from '../lib/logger.js';

class WixBlogExportCLI {
  async run(): Promise<void> {
    try {
      logger.header('🚀 Wix Blog Export Tool');
      logger.info('Export all your Wix blog posts to multiple formats');

      // Load and validate credentials
      logger.subheader('🔑 Setting up Wix API credentials');
      const credentials = loadCredentials();

      // Test API connection
      logger.subheader('🔍 Validating API connection');
      const apiClient = new WixApiClient(credentials);
      await apiClient.validateConnection();

      // Configure export options
      const options = this.getExportOptions();
      logger.subheader('📋 Export configuration');
      this.logExportOptions(options);

      // Fetch posts from Wix
      logger.subheader('📥 Fetching blog posts');
      const posts = await apiClient.fetchAllPosts();
      logger.success(`Successfully fetched ${posts.length} blog posts!`);

      // Export to files
      logger.subheader('💾 Exporting posts');
      const exporter = new PostExporter(options);
      const exportedFiles = await exporter.exportPosts(posts);

      // Success summary
      logger.success('Export completed successfully! 🎉');
      logger.info('');
      logger.info('Exported files:');
      exportedFiles.forEach(file => logger.info(`  • ${file}`));
      
    } catch (error) {
      if (error instanceof CredentialsError) {
        // Credentials error already logged with helpful instructions
        process.exit(1);
      } else {
        logger.error(`Export failed: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
      }
    }
  }

  /**
   * Returns sensible export defaults
   * In future versions, could be extended with CLI argument parsing
   */
  private getExportOptions(): ExportOptions {
    return {
      format: 'all', // Export to all supported formats
      includeContent: true, // Include full post content
      includeImages: true, // Include cover images
      downloadImages: false, // Don't download images by default
      outputDir: process.cwd(), // Export to current directory
      filename: 'wix-blog-export', // Base filename (timestamp will be added)
      bundleZip: false, // Don't create ZIP by default
      concurrency: 4, // Default concurrency for image downloads
      retry: 3, // Default retry count for failed downloads
      timeoutMs: 20000, // Default timeout for image downloads
      dryRun: false // Actually perform the export
    };
  }

  private logExportOptions(options: ExportOptions): void {
    logger.info(`Export format: ${options.format}`);
    logger.info(`Include full content: ${options.includeContent ? 'Yes' : 'No'}`);
    logger.info(`Include images: ${options.includeImages ? 'Yes' : 'No'}`);
    logger.info(`Output directory: ${options.outputDir}`);
  }
}

// Run CLI if called directly (ES module compatible check)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cli = new WixBlogExportCLI();
  cli.run();
}