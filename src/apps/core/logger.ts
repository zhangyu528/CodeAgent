/**
 * Logger utility using Winston
 * - Dev/Prod: file output in ~/.codeagent/logs/codeagent.log
 */

import { createLogger, format, transports } from 'winston';
import { join } from 'path';
import { homedir } from 'os';

const logDir = join(homedir(), '.codeagent', 'logs');

const logger = createLogger({
  level: 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ level, message, timestamp }) => {
      return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    })
  ),
  transports: [
    new transports.File({ filename: join(logDir, 'codeagent.log') }),
  ],
});

export { logger };
