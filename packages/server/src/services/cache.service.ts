import fse from 'fs-extra';
import { stat } from 'fs/promises';
import path from 'path';
import { DATA_DIR } from '../config';

// 缓存接口定义
export interface ImageCache {
  [subjectId: string]: {
    url: string;
    timestamp: number;
    isEmpty?: boolean; // 标记是否为空结果
  };
}

export interface PvBvidCache {
  [mediaId: string]: {
    bvid: string;
    timestamp: number;
    isEmpty?: boolean; // 标记是否为空结果
  };
}

export interface RssCache {
  [rssUrl: string]: {
    content: RssContent;
    timestamp: number;
    isEmpty?: boolean; // 标记是否为空结果
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

  setImageCache(subjectId: string, url: string | null) {
    if (url === null || url === 'https://lain.bgm.tv/img/no_icon_subject.png') {
      // 缓存空结果
      this.imageCache[subjectId] = {
        url: 'https://lain.bgm.tv/img/no_icon_subject.png',
        timestamp: Date.now(),
        isEmpty: true,
      };
    } else {
      this.imageCache[subjectId] = {
        url,
        timestamp: Date.now(),
        isEmpty: false,
      };
    }
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

  setPvBvidCache(mediaId: string, bvid: string | null) {
    if (bvid === null) {
      // 缓存空结果
      this.pvBvidCache[mediaId] = {
        bvid: '',
        timestamp: Date.now(),
        isEmpty: true,
      };
    } else {
      this.pvBvidCache[mediaId] = {
        bvid,
        timestamp: Date.now(),
        isEmpty: false,
      };
    }
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

  setRssCache(rssUrl: string, content: RssContent | null) {
    if (content === null) {
      // 缓存空结果
      this.rssCache[rssUrl] = {
        content: { title: '', description: '', link: '', items: [] },
        timestamp: Date.now(),
        isEmpty: true,
      };
    } else {
      this.rssCache[rssUrl] = {
        content,
        timestamp: Date.now(),
        isEmpty: false,
      };
    }
    this.saveRssCache().catch(console.error);
  }

  // 通用方法
  isExpired(timestamp: number, isRss = false): boolean {
    const expireTime = isRss
      ? this.RSS_CACHE_EXPIRE_TIME
      : this.CACHE_EXPIRE_TIME;
    return Date.now() - timestamp > expireTime;
  }

  // 检查是否为有效缓存（非空且未过期）
  isValidCache(cached: any, isRss = false): boolean {
    if (!cached) return false;
    if (this.isExpired(cached.timestamp, isRss)) return false;
    return true;
  }

  // 检查是否应该跳过刷新（包括空结果）
  shouldSkipRefresh(cached: any, isRss = false): boolean {
    return this.isValidCache(cached, isRss);
  }

  // 批量检查图片缓存状态
  public checkImageCacheBatch(subjectIds: string[]): {
    missing: string[];
    expired: string[];
  } {
    const missing: string[] = [];
    const expired: string[] = [];

    for (const subjectId of subjectIds) {
      const cached = this.getImageCache(subjectId);
      if (!cached) {
        missing.push(subjectId);
      } else if (this.isExpired(cached.timestamp)) {
        expired.push(subjectId);
      }
    }

    return { missing, expired };
  }

  // 批量获取缓存状态
  public getBatchCacheStatus(subjectIds: string[]): Record<string, boolean> {
    const status: Record<string, boolean> = {};

    for (const subjectId of subjectIds) {
      const cached = this.getImageCache(subjectId);
      status[subjectId] = cached && !this.isExpired(cached.timestamp);
    }

    return status;
  }
}

export default new CacheService();
