/**
 * Summary report generation for JSON and Markdown formats
 * Analyzes posts, images, tags, and provides comprehensive statistics
 */

import fs from 'fs';
import path from 'path';
import { WixBlogPost, SummaryReport, ImageDownloadResult } from './types.js';
import { createSafePath, formatBytes } from './utils.js';
import { logger } from './logger.js';

export class ReportGenerator {
  /**
   * Generates comprehensive summary report in JSON format
   */
  static generateSummaryReport(
    posts: WixBlogPost[],
    customer: string,
    imageResults: ImageDownloadResult[]
  ): SummaryReport {
    const generatedAt = new Date().toISOString();
    
    // Count posts by status
    const counts = {
      total: posts.length,
      published: posts.filter(p => p.status === 'PUBLISHED' || !p.status).length,
      draft: posts.filter(p => p.status === 'DRAFT').length,
      scheduled: posts.filter(p => p.status === 'SCHEDULED').length
    };

    // Image statistics
    const images = {
      attempted: imageResults.length,
      downloaded: imageResults.filter(r => r.success).length,
      failed: imageResults.filter(r => !r.success).length
    };

    // Tag analysis (top 10)
    const tagCounts = new Map<string, number>();
    posts.forEach(post => {
      post.hashtags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    
    const tagsTop10 = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    // Posts by year
    const yearCounts = new Map<number, number>();
    posts.forEach(post => {
      if (post.firstPublishedDate) {
        const year = new Date(post.firstPublishedDate).getFullYear();
        yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
      }
    });

    const byYear = Array.from(yearCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count }));

    // Failure analysis
    const failures = {
      imageDownloads: imageResults
        .filter(r => !r.success)
        .map(r => ({
          postId: r.postId,
          url: r.originalUrl,
          error: r.error || 'Unknown error'
        }))
    };

    return {
      generatedAt,
      customer,
      counts,
      images,
      tagsTop10,
      byYear,
      failures
    };
  }

  /**
   * Generates human-readable Markdown summary report
   */
  static generateMarkdownReport(report: SummaryReport): string {
    let markdown = '';

    // Header
    markdown += `# Wix Blog Export Summary\n\n`;
    markdown += `**Customer:** ${report.customer}\n`;
    markdown += `**Generated:** ${new Date(report.generatedAt).toLocaleString()}\n\n`;

    // Overview
    markdown += `## 📊 Overview\n\n`;
    markdown += `- **Total Posts:** ${report.counts.total}\n`;
    markdown += `- **Published:** ${report.counts.published}\n`;
    markdown += `- **Drafts:** ${report.counts.draft}\n`;
    markdown += `- **Scheduled:** ${report.counts.scheduled}\n\n`;

    // Images
    if (report.images.attempted > 0) {
      markdown += `## 📸 Images\n\n`;
      markdown += `- **Attempted:** ${report.images.attempted}\n`;
      markdown += `- **Downloaded:** ${report.images.downloaded}\n`;
      markdown += `- **Failed:** ${report.images.failed}\n`;
      
      if (report.images.attempted > 0) {
        const successRate = ((report.images.downloaded / report.images.attempted) * 100).toFixed(1);
        markdown += `- **Success Rate:** ${successRate}%\n`;
      }
      markdown += `\n`;
    }

    // Tags
    if (report.tagsTop10.length > 0) {
      markdown += `## 🏷️ Top Tags\n\n`;
      markdown += `| Tag | Count |\n`;
      markdown += `|-----|-------|\n`;
      report.tagsTop10.forEach(({ tag, count }) => {
        markdown += `| ${tag} | ${count} |\n`;
      });
      markdown += `\n`;
    }

    // Posts by year
    if (report.byYear.length > 0) {
      markdown += `## 📅 Posts by Year\n\n`;
      markdown += `| Year | Count |\n`;
      markdown += `|------|-------|\n`;
      report.byYear.forEach(({ year, count }) => {
        markdown += `| ${year} | ${count} |\n`;
      });
      markdown += `\n`;
    }

    // Failures
    if (report.failures.imageDownloads.length > 0) {
      markdown += `## ⚠️ Failed Downloads\n\n`;
      markdown += `${report.failures.imageDownloads.length} image(s) failed to download:\n\n`;
      report.failures.imageDownloads.forEach(({ postId, url, error }) => {
        markdown += `- **Post ${postId}:** ${url}\n`;
        markdown += `  *Error: ${error}*\n\n`;
      });
    }

    return markdown;
  }

  /**
   * Generates README-DELIVERY.md with import instructions
   */
  static generateDeliveryReadme(report: SummaryReport): string {
    let readme = '';

    readme += `# Wix Blog Export - Import Instructions\n\n`;
    readme += `**Customer:** ${report.customer}\n`;
    readme += `**Export Date:** ${new Date(report.generatedAt).toLocaleString()}\n`;
    readme += `**Total Posts:** ${report.counts.total}\n\n`;

    readme += `## 📁 What's Included\n\n`;
    readme += `- **posts/markdown/**: Individual Markdown files for each post\n`;
    readme += `- **posts/json/**: Complete post data in JSON format\n`;
    readme += `- **posts/csv/**: Spreadsheet-compatible post data\n`;
    
    if (report.images.downloaded > 0) {
      readme += `- **images/**: Downloaded cover and inline images (${report.images.downloaded} files)\n`;
    }
    
    readme += `- **reports/**: Summary statistics and any import issues\n\n`;

    readme += `## 🚀 How to Import\n\n`;

    // WordPress
    readme += `### WordPress\n\n`;
    readme += `**Option 1: WP All Import Plugin (Recommended)**\n`;
    readme += `1. Install [WP All Import](https://wordpress.org/plugins/wp-all-import/)\n`;
    readme += `2. Upload \`posts/csv/posts.csv\`\n`;
    readme += `3. Map columns: title → post_title, contentText → post_content, etc.\n`;
    readme += `4. Import images using the \`coverImageLocalPath\` column\n\n`;

    readme += `**Option 2: Manual Import**\n`;
    readme += `1. Copy Markdown files from \`posts/markdown/\` to your content folder\n`;
    readme += `2. Use a Markdown-to-WordPress converter\n`;
    readme += `3. Upload images from \`images/\` to your media library\n\n`;

    // Notion
    readme += `### Notion\n\n`;
    readme += `1. Create a new database or page in Notion\n`;
    readme += `2. Drag and drop the entire \`posts/markdown/\` folder\n`;
    readme += `3. Notion will automatically create pages from Markdown files\n`;
    readme += `4. Images with relative paths should display correctly\n\n`;

    // Substack
    readme += `### Substack\n\n`;
    readme += `1. Go to your Substack writer dashboard\n`;
    readme += `2. Create a new post\n`;
    readme += `3. Copy and paste content from individual Markdown files\n`;
    readme += `4. Upload images manually from the \`images/\` folder\n`;
    readme += `5. Replace image paths with uploaded image URLs\n\n`;

    // Medium
    readme += `### Medium\n\n`;
    readme += `1. Use [medium-to-markdown](https://github.com/gautamdhameja/medium-to-markdown) in reverse\n`;
    readme += `2. Or copy/paste Markdown content into Medium's editor\n`;
    readme += `3. Upload images manually and replace relative paths\n\n`;

    // Ghost
    readme += `### Ghost\n\n`;
    readme += `1. Use Ghost's official [migration tools](https://ghost.org/docs/migration/)\n`;
    readme += `2. Convert CSV to Ghost JSON format\n`;
    readme += `3. Import via Ghost Admin → Labs → Import content\n\n`;

    readme += `## 🔧 Technical Notes\n\n`;
    readme += `- Markdown files use relative image paths (\`images/post-slug/image-name.ext\`)\n`;
    readme += `- CSV includes both original URLs and local paths for images\n`;
    readme += `- JSON contains complete metadata including view counts, reading time, etc.\n`;
    readme += `- All timestamps are in ISO 8601 format (UTC)\n\n`;

    if (report.failures.imageDownloads.length > 0) {
      readme += `## ⚠️ Known Issues\n\n`;
      readme += `${report.failures.imageDownloads.length} image(s) failed to download. `;
      readme += `Check \`reports/summary.md\` for details. You may need to manually download these images:\n\n`;
      
      report.failures.imageDownloads.slice(0, 5).forEach(({ url }) => {
        readme += `- ${url}\n`;
      });

      if (report.failures.imageDownloads.length > 5) {
        readme += `- ... and ${report.failures.imageDownloads.length - 5} more (see summary.md)\n`;
      }
      readme += `\n`;
    }

    readme += `## 📞 Support\n\n`;
    readme += `If you encounter issues during import:\n\n`;
    readme += `1. Check the \`reports/summary.json\` for detailed statistics\n`;
    readme += `2. Refer to your target platform's import documentation\n`;
    readme += `3. Consider using platform-specific migration tools\n\n`;

    readme += `---\n\n`;
    readme += `Generated by [Wix Blog Export Tool](https://github.com/Surfrrosa/wix-blog-export)\n`;

    return readme;
  }

  /**
   * Saves all report files to the reports directory
   */
  static async saveReports(
    outputDir: string,
    report: SummaryReport
  ): Promise<void> {
    logger.step('Generating summary reports...');

    const reportsDir = createSafePath(outputDir, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Save JSON report
    const jsonPath = createSafePath(reportsDir, 'summary.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

    // Save Markdown report
    const markdownReport = this.generateMarkdownReport(report);
    const mdPath = createSafePath(reportsDir, 'summary.md');
    fs.writeFileSync(mdPath, markdownReport, 'utf8');

    // Save delivery README
    const deliveryReadme = this.generateDeliveryReadme(report);
    const readmePath = createSafePath(outputDir, 'README-DELIVERY.md');
    fs.writeFileSync(readmePath, deliveryReadme, 'utf8');

    logger.success('Summary reports generated');
  }
}