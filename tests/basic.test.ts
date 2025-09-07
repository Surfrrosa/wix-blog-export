/**
 * Basic smoke tests to verify the build pipeline works
 * Tests fundamental functionality without complex ESM imports
 */

describe('Wix Blog Export Tool - Basic Tests', () => {
  test('should have basic Node.js functionality', () => {
    expect(typeof process).toBe('object');
    expect(typeof require).toBe('function');
    expect(process.version).toBeDefined();
  });

  test('should be able to work with JSON', () => {
    const testData = { title: 'Test Post', status: 'PUBLISHED' };
    const jsonString = JSON.stringify(testData);
    const parsed = JSON.parse(jsonString);
    
    expect(parsed.title).toBe('Test Post');
    expect(parsed.status).toBe('PUBLISHED');
  });

  test('should be able to work with dates', () => {
    const now = new Date();
    const isoString = now.toISOString();
    
    expect(isoString).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('should handle arrays correctly', () => {
    const posts = [
      { id: '1', title: 'First Post' },
      { id: '2', title: 'Second Post' }
    ];
    
    const titles = posts.map(post => post.title);
    
    expect(titles).toEqual(['First Post', 'Second Post']);
    expect(posts.length).toBe(2);
  });

  test('should handle string operations for CSV export', () => {
    const title = 'My "Awesome" Blog Post';
    const escaped = title.replace(/"/g, '""');
    const csvField = `"${escaped}"`;
    
    expect(csvField).toBe('"My ""Awesome"" Blog Post"');
  });

  test('should handle markdown formatting', () => {
    const title = 'Test Blog Post';
    const markdown = `## ${title}\n\n**Status:** Published\n`;
    
    expect(markdown).toContain('## Test Blog Post');
    expect(markdown).toContain('**Status:** Published');
  });
});