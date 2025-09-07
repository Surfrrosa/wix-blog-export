/**
 * Simple integration test to verify the export pipeline works
 * Demonstrates the tool functionality without external dependencies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PostExporter } from '../lib/exporters.js';
import { WixBlogPost, ExportOptions } from '../lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock console methods to prevent output during tests
const originalLog = console.log;
const originalError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe('Wix Blog Export Tool', () => {
  const testDir = path.join(__dirname, 'test-output');

  beforeEach(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test('should export blog posts to all formats', async () => {
    const mockPost: WixBlogPost = {
      id: 'test-id',
      title: 'Test Blog Post',
      excerpt: 'This is a test excerpt for the blog post',
      contentText: 'This is the full content of the test blog post.',
      slug: 'test-blog-post',
      firstPublishedDate: '2023-01-15T10:00:00Z',
      lastPublishedDate: '2023-01-15T10:00:00Z',
      status: 'PUBLISHED',
      featured: true,
      categoryIds: [],
      tagIds: [],
      relatedPostIds: [],
      hashtags: ['test', 'blog', 'export'],
      commentingEnabled: true,
      minutesToRead: 5,
      language: 'en',
      media: {
        wixMedia: {
          image: {
            url: 'https://example.com/test-image.jpg',
            altText: 'Test image',
            height: 600,
            width: 800
          }
        },
        displayed: true
      }
    };

    const options: ExportOptions = {
      format: 'all',
      includeContent: true,
      includeImages: true,
      outputDir: testDir,
      filename: 'integration-test'
    };

    const exporter = new PostExporter(options);
    const exportedFiles = await exporter.exportPosts([mockPost]);

    // Verify all three formats were created
    expect(exportedFiles).toHaveLength(3);
    
    const extensions = exportedFiles.map(file => path.extname(file));
    expect(extensions).toContain('.json');
    expect(extensions).toContain('.md');
    expect(extensions).toContain('.csv');

    // Verify files exist and contain expected content
    exportedFiles.forEach(filename => {
      const filePath = path.join(testDir, filename);
      expect(fs.existsSync(filePath)).toBe(true);
      
      const content = fs.readFileSync(filePath, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('Test Blog Post');
    });

    // Verify JSON structure
    const jsonFile = exportedFiles.find(file => file.endsWith('.json'));
    const jsonPath = path.join(testDir, jsonFile!);
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    expect(jsonData).toHaveLength(1);
    expect(jsonData[0].title).toBe('Test Blog Post');
    expect(jsonData[0].status).toBe('PUBLISHED');
    expect(jsonData[0].hashtags).toEqual(['test', 'blog', 'export']);

    // Verify Markdown structure
    const mdFile = exportedFiles.find(file => file.endsWith('.md'));
    const mdPath = path.join(testDir, mdFile!);
    const mdContent = fs.readFileSync(mdPath, 'utf8');
    
    expect(mdContent).toContain('# Wix Blog Export');
    expect(mdContent).toContain('## Test Blog Post');
    expect(mdContent).toContain('**Featured:** ⭐ Yes');
    expect(mdContent).toContain('**Tags:** #test #blog #export');
    expect(mdContent).toContain('This is a test excerpt');
  });

  test('should handle posts without optional content', async () => {
    const minimalPost: WixBlogPost = {
      id: 'minimal-id',
      title: 'Minimal Post',
      excerpt: '',
      slug: 'minimal-post',
      firstPublishedDate: '2023-01-15T10:00:00Z',
      lastPublishedDate: '2023-01-15T10:00:00Z',
      featured: false,
      categoryIds: [],
      tagIds: [],
      relatedPostIds: [],
      hashtags: [],
      commentingEnabled: true,
      minutesToRead: 1,
      language: 'en'
    };

    const options: ExportOptions = {
      format: 'markdown',
      includeContent: true,
      includeImages: true,
      outputDir: testDir,
      filename: 'minimal-test'
    };

    const exporter = new PostExporter(options);
    const exportedFiles = await exporter.exportPosts([minimalPost]);

    expect(exportedFiles).toHaveLength(1);
    
    const mdPath = path.join(testDir, exportedFiles[0]);
    const content = fs.readFileSync(mdPath, 'utf8');
    
    expect(content).toContain('## Minimal Post');
    expect(content).toContain('No excerpt available');
    expect(content).not.toContain('**Tags:**'); // Should skip empty tags
    expect(content).not.toContain('**Featured:**'); // Should skip non-featured
  });
});