/**
 * Colored console logger for better CLI user experience
 * Uses ANSI escape codes for terminal colors
 */

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

export const logger = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  step: (msg: string) => console.log(`${colors.cyan}🔄${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.magenta}${msg}${colors.reset}\n${'='.repeat(msg.length)}`),
  subheader: (msg: string) => console.log(`\n${colors.bright}${msg}${colors.reset}`)
};