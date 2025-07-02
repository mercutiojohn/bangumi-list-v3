import path from 'path';
import fse from 'fs-extra';

export const HOST = process.env.HOST || '';
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

export const RUNTIME_DIR =
  process.env.RUNTIME_DIR || path.resolve(process.cwd(), '.run');

export const LOG_DIR = process.env.LOG_DIR || path.resolve(RUNTIME_DIR, 'logs');

export const LOG_FILE = process.env.LOG_FILE || 'server.log';

export const DB_DIR = process.env.DB_DIR || RUNTIME_DIR;

export const DATA_DIR = process.env.DATA_DIR || RUNTIME_DIR;

export const DATA_FILE = process.env.DATA_FILE || 'data.json';

export const CLIENT_DIST_DIR =
  process.env.CLIENT_DIST_DIR || path.resolve(__dirname, '../../client/dist');

// 在应用启动时确保所有必要目录存在
try {
  fse.ensureDirSync(RUNTIME_DIR);
  fse.ensureDirSync(LOG_DIR);
  fse.ensureDirSync(DB_DIR);
  fse.ensureDirSync(DATA_DIR);
  console.log('[Config] All directories ensured');
} catch (error) {
  console.error('[Config] Failed to create directories:', error);
}
