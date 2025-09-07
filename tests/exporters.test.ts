/**
 * Unit tests for export formatters  
 * Tests the core export logic without requiring Wix API calls
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PostExporter } from '../lib/exporters.js';
import { WixBlogPost, ExportOptions } from '../lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock logger to prevent console output during tests
jest.mock('../lib/logger.js', () => ({
  logger: {
    success: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    step: jest.fn(),
    header: jest.fn(),
    subheader: jest.fn()
  }
}));

describe('PostExporter', () => {
  const testDir = path.join(__dirname, 'test-output');
  let exporter: PostExporter;
  let mockPosts: WixBlogPost[];

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const options: ExportOptions = {
      format: 'all',
      includeContent: true,
      includeImages: true,
      outputDir: testDir,
      filename: 'test-export'
    };

    exporter = new PostExporter(options);

    // Create mock blog posts
    mockPosts = [
      {
        id: '1',
        title: 'Test Blog Post',
        excerpt: 'This is a test excerpt',
        contentText: 'This is the full content of the test post',
        slug: 'test-blog-post',
        firstPublishedDate: '2023-01-15T10:00:00Z',
        lastPublishedDate: '2023-01-15T10:00:00Z',
        status: 'PUBLISHED',
        featured: true,
        categoryIds: [],
        tagIds: [],
        relatedPostIds: [],
        hashtags: ['test', 'blog'],
        commentingEnabled: true,
        minutesToRead: 5,
        language: 'en',
        media: {
          wixMedia: {
            image: {
              url: 'https://example.com/image.jpg',
              altText: 'Test image',
              height: 600,
              width: 800
            }
          },
          displayed: true
        }
      },
      {
        id: '2',
        title: 'Draft Post',
        excerpt: 'This is a draft post',
        slug: 'draft-post',
        firstPublishedDate: '2023-01-16T10:00:00Z',
        lastPublishedDate: '2023-01-16T10:00:00Z',
        status: 'DRAFT',
        featured: false,
        categoryIds: [],
        tagIds: [],
        relatedPostIds: [],
        hashtags: [],
        commentingEnabled: true,
        minutesToRead: 3,
        language: 'en'
      }
    ];
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should export posts to JSON format correctly', async () => {
    const exporter = new PostExporter({
      format: 'json',
      includeContent: true,
      includeImages: true,
      outputDir: testDir,
      filename: 'json-test'
    });

    const exportedFiles = await exporter.exportPosts(mockPosts);
    
    expect(exportedFiles).toHaveLength(1);
    expect(exportedFiles[0]).toMatch(/json-test-.*\\.json$/);
    
    const filePath = path.join(testDir, exportedFiles[0]);
    expect(fs.existsSync(filePath)).toBe(true);
    
    const exportedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(exportedData).toHaveLength(2);
    expect(exportedData[0].title).toBe('Test Blog Post');
    expect(exportedData[1].status).toBe('DRAFT');
  });

  it('should export posts to Markdown format with correct structure', async () => {
    const exporter = new PostExporter({
      format: 'markdown',
      includeContent: true,
      includeImages: true,
      outputDir: testDir,
      filename: 'markdown-test'
    });

    const exportedFiles = await exporter.exportPosts(mockPosts);
    
    expect(exportedFiles).toHaveLength(1);
    expect(exportedFiles[0]).toMatch(/markdown-test-.*\\.md$/);
    
    const filePath = path.join(testDir, exportedFiles[0]);
    expect(fs.existsSync(filePath)).toBe(true);
    
    const markdownContent = fs.readFileSync(filePath, 'utf8');
    
    // Check header structure
    expect(markdownContent).toContain('# Wix Blog Export');
    expect(markdownContent).toContain('📝 Published: 1');
    expect(markdownContent).toContain('📋 Drafts: 1');
    expect(markdownContent).toContain('📊 Total: 2');
    
    // Check post content
    expect(markdownContent).toContain('## Test Blog Post');
    expect(markdownContent).toContain('**Featured:** ⭐ Yes');
    expect(markdownContent).toContain('**Tags:** #test #blog');
    expect(markdownContent).toContain('![Test Blog Post](https://example.com/image.jpg)');
    
    // Check draft section
    expect(markdownContent).toContain('# 📋 Draft Posts (1)');
    expect(markdownContent).toContain('## Draft Post');
  });

  it('should export posts to CSV format with proper escaping', async () => {
    const exporter = new PostExporter({
      format: 'csv',
      includeContent: true,
      includeImages: true,
      outputDir: testDir,
      filename: 'csv-test'
    });

    const exportedFiles = await exporter.exportPosts(mockPosts);
    
    expect(exportedFiles).toHaveLength(1);
    expect(exportedFiles[0]).toMatch(/csv-test-.*\\.csv$/);
    
    const filePath = path.join(testDir, exportedFiles[0]);
    expect(fs.existsSync(filePath)).toBe(true);
    
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    // Check header
    expect(lines[0]).toContain('Title,Slug,Status');
    
    // Check data rows
    expect(lines[1]).toContain('"Test Blog Post"');
    expect(lines[1]).toContain('"test-blog-post"');
    expect(lines[1]).toContain('"PUBLISHED"');
    expect(lines[1]).toContain('"Yes"'); // Featured flag
    expect(lines[1]).toContain('"test, blog"'); // Tags
    
    expect(lines[2]).toContain('"Draft Post"');
    expect(lines[2]).toContain('"DRAFT"');
    expect(lines[2]).toContain('"No"'); // Not featured
  });

  it('should export to all formats when format is "all"', async () => {
    const exportedFiles = await exporter.exportPosts(mockPosts);
    
    expect(exportedFiles).toHaveLength(3);
    
    const extensions = exportedFiles.map(file => path.extname(file));
    expect(extensions).toContain('.json');
    expect(extensions).toContain('.md');
    expect(extensions).toContain('.csv');
    
    // Verify all files exist
    exportedFiles.forEach(filename => {
      const filePath = path.join(testDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  it('should handle posts without content gracefully', async () => {
    const postWithoutContent: WixBlogPost = {
      ...mockPosts[0],
      contentText: undefined,
      media: undefined,
      hashtags: []
    };

    const exportedFiles = await exporter.exportPosts([postWithoutContent]);
    
    const markdownFile = exportedFiles.find(file => file.endsWith('.md'));
    expect(markdownFile).toBeDefined();
    
    const filePath = path.join(testDir, markdownFile!);
    const content = fs.readFileSync(filePath, 'utf8');
    
    expect(content).toContain('No excerpt available');
    expect(content).not.toContain('### Content'); // Should skip content section
    expect(content).not.toContain('**Tags:**'); // Should skip empty tags
    expect(content).not.toContain('!['); // Should skip missing images
  });
});