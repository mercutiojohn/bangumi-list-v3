import fse from 'fs-extra';
import { stat } from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '../config';

// 缓存接口定义
export interface ImageCache {
  [subjectId: string]: {
    url: string;
    timestamp: number;
  };
}

export interface PvBvidCache {
  [mediaId: string]: {
    bvid: string;
    timestamp: number;
  };
}

export interface RssCache {
  [rssUrl: string]: {
    content: RssContent;
    timestamp: number;
  };
}

export interface RssContent {
  title: string;
  description: string;
  link: string;
  items: RssItem[];
}

export interface RssItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  guid?: string;
  enclosure?: {
    url: string;
    type: string;
    length: string;
  };
}

export class CacheService {
  private readonly CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 7天过期
  private readonly RSS_CACHE_EXPIRE_TIME = 6 * 60 * 60 * 1000; // RSS缓存6小时过期

  private imageCache: ImageCache = {};
  private pvBvidCache: PvBvidCache = {};
  private rssCache: RssCache = {};

  private readonly imageCachePath: string;
  private readonly pvBvidCachePath: string;
  private readonly rssCachePath: string;

  constructor() {
    this.imageCachePath = path.resolve(DATA_DIR, 'image-cache.json');
    this.pvBvidCachePath = path.resolve(DATA_DIR, 'pv-bvid-cache.json');
    this.rssCachePath = path.resolve(DATA_DIR, 'rss-cache.json');
  }

  async init() {
    await this.loadImageCache();
    await this.loadPvBvidCache();
    await this.loadRssCache();
  }

  // Image Cache 方法
  async loadImageCache() {
    try {
      const statRes = await stat(this.imageCachePath);
      const cacheExpireTime = Date.now() - this.CACHE_EXPIRE_TIME;
      if (statRes.mtimeMs < cacheExpireTime) {
        await fse.unlink(this.imageCachePath);
      } else {
        this.imageCache = await fse.readJSON(this.imageCachePath);
      }
    } catch (e) {
      // ignore
    }
  }

  async saveImageCache() {
    try {
      await fse.writeJSON(this.imageCachePath, this.imageCache);
    } catch (e) {
      console.error('Failed to save image cache:', e);
    }
  }

  getImageCache(subjectId: string) {
    return this.imageCache[subjectId];
  }

  setImageCache(subjectId: string, url: string) {
    this.imageCache[subjectId] = {
      url,
      timestamp: Date.now(),
    };
    this.saveImageCache().catch(console.error);
  }

  // PV Cache 方法
  async loadPvBvidCache() {
    try {
      const statRes = await stat(this.pvBvidCachePath);
      const cacheExpireTime = Date.now() - this.CACHE_EXPIRE_TIME;
      if (statRes.mtimeMs < cacheExpireTime) {
        await fse.unlink(this.pvBvidCachePath);
      } else {
        this.pvBvidCache = await fse.readJSON(this.pvBvidCachePath);
      }
    } catch (e) {
      // ignore
    }
  }

  async savePvBvidCache() {
    try {
      await fse.writeJSON(this.pvBvidCachePath, this.pvBvidCache);
    } catch (e) {
      console.error('Failed to save PV bvid cache:', e);
    }
  }

  getPvBvidCache(mediaId: string) {
    return this.pvBvidCache[mediaId];
  }

  setPvBvidCache(mediaId: string, bvid: string) {
    this.pvBvidCache[mediaId] = {
      bvid,
      timestamp: Date.now(),
    };
    this.savePvBvidCache().catch(console.error);
  }

  // RSS Cache 方法
  async loadRssCache() {
    try {
      const statRes = await stat(this.rssCachePath);
      const cacheExpireTime = Date.now() - this.RSS_CACHE_EXPIRE_TIME;
      if (statRes.mtimeMs < cacheExpireTime) {
        await fse.unlink(this.rssCachePath);
      } else {
        this.rssCache = await fse.readJSON(this.rssCachePath);
      }
    } catch (e) {
      // ignore
    }
  }

  async saveRssCache() {
    try {
      await fse.writeJSON(this.rssCachePath, this.rssCache);
    } catch (e) {
      console.error('Failed to save RSS cache:', e);
    }
  }

  getRssCache(rssUrl: string) {
    return this.rssCache[rssUrl];
  }

  setRssCache(rssUrl: string, content: RssContent) {
    this.rssCache[rssUrl] = {
      content,
      timestamp: Date.now(),
    };
    this.saveRssCache().catch(console.error);
  }

  // 通用方法
  isExpired(timestamp: number, isRss = false): boolean {
    const expireTime = isRss
      ? this.RSS_CACHE_EXPIRE_TIME
      : this.CACHE_EXPIRE_TIME;
    return Date.now() - timestamp > expireTime;
  }
}

export default new CacheService();
