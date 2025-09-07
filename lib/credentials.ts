/**
 * Credential management for Wix API authentication
 * Loads from .env.wix file with clear error messages
 */

import fs from 'fs';
import path from 'path';
import { WixCredentials } from './types.js';
import { logger } from './logger.js';

export function loadCredentials(): WixCredentials {
  const envPath = path.join(process.cwd(), '.env.wix');
  
  if (!fs.existsSync(envPath)) {
    throw new CredentialsError('Missing .env.wix file');
  }

  logger.info('Found .env.wix file, loading credentials...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  
  // Parse .env file format
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        env[key.trim()] = value.trim();
      }
    }
  });

  // Validate required fields
  const required = ['WIX_API_KEY', 'WIX_ACCOUNT_ID', 'WIX_SITE_ID'];
  const missing = required.filter(field => !env[field]);
  
  if (missing.length > 0) {
    throw new CredentialsError(`Missing required fields: ${missing.join(', ')}`);
  }

  logger.success('Credentials loaded successfully');
  
  return {
    apiKey: env.WIX_API_KEY,
    accountId: env.WIX_ACCOUNT_ID,
    siteId: env.WIX_SITE_ID
  };
}

export class CredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialsError';
    
    // Provide helpful setup instructions
    logger.error(message);
    logger.info('');
    logger.info('Please create a .env.wix file in your current directory with:');
    logger.info('');
    logger.info('WIX_API_KEY=your_api_key_here');
    logger.info('WIX_ACCOUNT_ID=your_account_id_here');
    logger.info('WIX_SITE_ID=your_site_id_here');
    logger.info('');
    logger.info('Get your API key from: https://manage.wix.com/account/api-keys');
    logger.info('Find your Site ID in your dashboard URL: https://manage.wix.com/dashboard/[SITE-ID]/...');
  }
}