import { stat } from 'fs/promises';
import fs, { constants } from 'fs';
import fse from 'fs-extra';
import path from 'path';
import {
  BangumiSite,
  Data,
  Item,
  SiteItem,
  SiteType,
} from 'bangumi-list-v3-shared';
import moment from 'moment';
import axios, { AxiosResponse } from 'axios';
import { Stream } from 'stream';
import md5 from 'md5';
import { DATA_DIR, DATA_FILE } from '../config';
import { flatten } from 'lodash';
import pinyin from 'pinyin';
// 添加定时任务库
import * as cron from 'node-cron';
// 添加XML解析库
import * as xml2js from 'xml2js';

// 图片缓存接口
interface ImageCache {
  [subjectId: string]: {
    url: string;
    timestamp: number;
  };
}

// PV bvid 缓存接口
interface PvBvidCache {
  [mediaId: string]: {
    bvid: string;
    timestamp: number;
  };
}

// RSS缓存接口
interface RssCache {
  [rssUrl: string]: {
    content: RssContent;
    timestamp: number;
  };
}

// RSS内容接口
interface RssContent {
  title: string;
  description: string;
  link: string;
  items: RssItem[];
}

// RSS项目接口
interface RssItem {
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

// B站官方API响应接口
interface BilibiliMediaResponse {
  code: number;
  message: string;
  result: {
    media: {
      areas: Array<{
        id: number;
        name: string;
      }>;
      cover: string;
      horizontal_picture: string;
      media_id: number;
      new_ep: {
        id: number;
        index: string;
        index_show: string;
      };
      rating: {
        count: number;
        score: number;
      };
      season_id: number;
      share_url: string;
      title: string;
      type: number;
      type_name: string;
    };
  };
}

// Biliplus API 响应接口
interface BiliplusResponse {
  code: number;
  message: string;
  result: {
    season_id: number;
    season_title: string;
    section: Array<{
      attr: number;
      episode_id: number;
      episode_ids: number[];
      episodes: Array<{
        aid: number;
        badge: string;
        badge_info: {
          bg_color: string;
          bg_color_night: string;
          text: string;
        };
        badge_type: number;
        bvid: string;
        cid: number;
        cover: string;
        dimension: {
          height: number;
          rotate: number;
          width: number;
        };
        duration: number;
        enable_vt: boolean;
        ep_id: number;
        from: string;
        icon_font: {
          name: string;
          text: string;
        };
        id: number;
        is_view_hide: boolean;
        link: string;
        long_title: string;
        pub_time: number;
        pv: number;
        release_date: string;
        rights: {
          allow_dm: number;
          allow_download: number;
          area_limit: number;
        };
        section_type: number;
        share_copy: string;
        share_url: string;
        short_link: string;
        showDrmLoginDialog: boolean;
        show_title: string;
        skip: {
          ed: {
            end: number;
            start: number;
          };
          op: {
            end: number;
            start: number;
          };
        };
        stat: {
          coin: number;
          danmakus: number;
          likes: number;
          play: number;
          reply: number;
          vt: number;
        };
        stat_for_unity: {
          coin: number;
          danmaku: {
            icon: string;
            pure_text: string;
            text: string;
            value: number;
          };
          likes: number;
          reply: number;
          vt: {
            icon: string;
            pure_text: string;
            text: string;
            value: number;
          };
        };
        status: number;
        subtitle: string;
        title: string;
        vid: string;
      }>;
      id: number;
      title: string;
      type: number;
      type2: number;
    }>;
  };
}

export interface SiteMap {
  [SiteType.INFO]?: {
    [key: string]: SiteItem;
  };
  [SiteType.ONAIR]?: {
    [key: string]: SiteItem;
  };
  [SiteType.RESOURCE]?: {
    [key: string]: SiteItem;
  };
}

// 添加失败项接口
interface FailedItem {
  id: string;
  type: 'image' | 'pv' | 'rss';
  subjectId?: string;
  mediaId?: string;
  rssUrl?: string;
  retryCount: number;
  lastRetryTime: number;
}

class BangumiModel {
  public seasons: string[] = [];
  public seasonIds: { [key: string]: string[] } = {};
  public noEndDateIds: string[] = [];
  public itemEntities: { [key: string]: Item } = {};
  public siteMap: SiteMap = {};
  public data?: Data;
  public version = 0;

  private dataPath: string;
  private dataFolderPath: string;
  private dataURL =
    'https://raw.staticdn.net/bangumi-data/bangumi-data/master/dist/data.json';
  private imageCache: ImageCache = {};
  private imageCachePath: string;
  private pvBvidCache: PvBvidCache = {};
  private pvBvidCachePath: string;
  private rssCache: RssCache = {};
  private rssCachePath: string;
  private readonly CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 7天过期
  private readonly RSS_CACHE_EXPIRE_TIME = 6 * 60 * 60 * 1000; // RSS缓存6小时过期
  private readonly BANGUMI_API_BASE = 'https://api.bgm.tv/v0';
  private readonly BILIBILI_API_BASE = 'https://api.bilibili.com';
  private readonly BILIPLUS_API_BASE = 'https://www.biliplus.com/api/bangumi';
  private cacheRefreshTask?: cron.ScheduledTask;
  private failedItems: FailedItem[] = [];
  private retryTimer?: NodeJS.Timeout;
  private isRefreshing = false;

  constructor() {
    this.dataFolderPath = DATA_DIR;
    this.dataPath = path.resolve(DATA_DIR, DATA_FILE);
    this.imageCachePath = path.resolve(DATA_DIR, 'image-cache.json');
    this.pvBvidCachePath = path.resolve(DATA_DIR, 'pv-bvid-cache.json');
    this.rssCachePath = path.resolve(DATA_DIR, 'rss-cache.json');
    this.loadImageCache();
    this.loadPvBvidCache();
    this.loadRssCache();
    this.startCacheRefreshScheduler();
  }

  // 获取当前季度
  private getCurrentSeason(): string {
    return moment().format('YYYY[q]Q');
  }

  // 判断是否为当季度新番
  private isCurrentSeasonItem(item: Item): boolean {
    const { begin } = item;
    const beginDate = moment(begin);
    const itemSeason = beginDate.format('YYYY[q]Q');
    const currentSeason = this.getCurrentSeason();
    return itemSeason === currentSeason;
  }

  // 获取当季度新番列表
  private getCurrentSeasonItems(): Item[] {
    if (!this.data) return [];

    return this.data.items.filter((item) => this.isCurrentSeasonItem(item));
  }

  // 启动缓存刷新调度器
  private startCacheRefreshScheduler() {
    // 每天凌晨2点执行缓存刷新
    this.cacheRefreshTask = cron.schedule(
      '0 2 * * *',
      async () => {
        const currentSeason = this.getCurrentSeason();
        console.log(
          `[Cache] Starting daily cache refresh for current season (${currentSeason})...`
        );
        try {
          await this.refreshAllCaches();
          console.log(
            `[Cache] Daily cache refresh for current season (${currentSeason}) completed successfully`
          );
        } catch (error) {
          console.error(
            `[Cache] Daily cache refresh for current season (${currentSeason}) failed:`,
            error
          );
        }
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    console.log(
      '[Cache] Cache refresh scheduler started, will refresh current season items daily at 2:00 AM'
    );
  }

  // 启动时初始刷新
  public async initialCacheRefresh(): Promise<void> {
    if (!this.data) {
      console.log('[Cache] No data loaded, skipping initial cache refresh');
      return;
    }

    const currentSeason = this.getCurrentSeason();
    console.log(
      `[Cache] Starting initial cache refresh for current season (${currentSeason}) on startup...`
    );
    try {
      await this.refreshAllCaches();
      console.log(
        `[Cache] Initial cache refresh for current season (${currentSeason}) completed successfully`
      );
    } catch (error) {
      console.error(
        `[Cache] Initial cache refresh for current season (${currentSeason}) failed:`,
        error
      );
    }
  }

  // 刷新所有缓存
  public async refreshAllCaches(): Promise<void> {
    if (this.isRefreshing) {
      console.log('[Cache] Cache refresh already in progress, skipping...');
      return;
    }

    this.isRefreshing = true;

    try {
      if (!this.data) {
        console.log('[Cache] No data loaded, skipping cache refresh');
        return;
      }

      // 只获取当季度新番
      const currentSeasonItems = this.getCurrentSeasonItems();
      const currentSeason = this.getCurrentSeason();

      console.log(`[Cache] Current season: ${currentSeason}`);
      console.log(
        `[Cache] Found ${currentSeasonItems.length} current season items out of ${this.data.items.length} total items`
      );

      if (currentSeasonItems.length === 0) {
        console.log(
          '[Cache] No current season items found, skipping cache refresh'
        );
        return;
      }

      const CONCURRENT_LIMIT = 2;
      const chunks = [];

      // 分批处理当季度新番
      for (let i = 0; i < currentSeasonItems.length; i += CONCURRENT_LIMIT) {
        chunks.push(currentSeasonItems.slice(i, i + CONCURRENT_LIMIT));
      }

      let processedCount = 0;
      let successCount = 0;
      let skippedCount = 0;
      const totalCount = currentSeasonItems.length;
      const currentFailedItems: FailedItem[] = [];

      console.log(
        `[Cache] Starting to refresh cache for ${totalCount} current season items...`
      );

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (item) => {
            try {
              // 刷新图片缓存 - 只有缓存中没有数据时才刷新
              const subjectId = this.getBangumiSubjectId(item);
              if (subjectId) {
                if (this.imageCache[subjectId]) {
                  skippedCount++;
                } else {
                  try {
                    await this.fetchBangumiImage(subjectId);
                    successCount++;
                  } catch (error) {
                    console.error(
                      `[Cache] Failed to refresh image for item ${item.title} (${subjectId}):`,
                      error
                    );
                    currentFailedItems.push({
                      id: item.id || subjectId,
                      type: 'image',
                      subjectId,
                      retryCount: 0,
                      lastRetryTime: Date.now(),
                    });
                  }
                }
              }

              // 刷新 PV bvid 缓存 - 只有缓存中没有数据时才刷新
              const mediaId = this.getBilibiliMediaId(item);
              if (mediaId) {
                if (this.pvBvidCache[mediaId]) {
                  skippedCount++;
                } else {
                  try {
                    await this.fetchPvBvid(mediaId);
                    successCount++;
                  } catch (error) {
                    console.error(
                      `[Cache] Failed to refresh PV for item ${item.title} (${mediaId}):`,
                      error
                    );
                    currentFailedItems.push({
                      id: item.id || mediaId,
                      type: 'pv',
                      mediaId,
                      retryCount: 0,
                      lastRetryTime: Date.now(),
                    });
                  }
                }
              }

              // 刷新 RSS 缓存 - 根据缓存过期时间判断是否需要刷新
              const rssUrl = this.getMikanRssUrl(item);
              if (rssUrl) {
                const now = Date.now();
                const cached = this.rssCache[rssUrl];

                if (
                  cached &&
                  now - cached.timestamp < this.RSS_CACHE_EXPIRE_TIME
                ) {
                  skippedCount++;
                } else {
                  try {
                    await this.fetchRssContent(rssUrl);
                    successCount++;
                  } catch (error) {
                    console.error(
                      `[Cache] Failed to refresh RSS for item ${item.title} (${rssUrl}):`,
                      error
                    );
                    currentFailedItems.push({
                      id: item.id || rssUrl,
                      type: 'rss',
                      rssUrl,
                      retryCount: 0,
                      lastRetryTime: Date.now(),
                    });
                  }
                }
              }

              processedCount++;
              if (processedCount % 10 === 0) {
                console.log(
                  `[Cache] Progress: ${processedCount}/${totalCount} current season items processed, ${successCount} successful, ${skippedCount} skipped`
                );
              }
            } catch (error) {
              console.error(
                `[Cache] Failed to process current season item ${item.title}:`,
                error
              );
            }
          })
        );

        // 在批次之间添加延迟，避免API限制
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      console.log(
        `[Cache] Cache refresh completed for current season (${currentSeason}): ${processedCount}/${totalCount} items processed, ${successCount} successful, ${skippedCount} skipped, ${currentFailedItems.length} failed`
      );

      // 更新失败项列表
      this.failedItems = currentFailedItems;

      // 如果有失败项，启动重试机制
      if (this.failedItems.length > 0) {
        console.log(
          `[Cache] Starting retry mechanism for ${this.failedItems.length} failed current season items`
        );
        this.scheduleRetry();
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  // 调度重试失败项
  private scheduleRetry(): void {
    // 清除之前的重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    // 1分钟后重试
    this.retryTimer = setTimeout(async () => {
      await this.retryFailedItems();
    }, 60 * 1000);
  }

  // 重试失败项
  private async retryFailedItems(): Promise<void> {
    if (this.failedItems.length === 0) {
      console.log('[Cache] No failed items to retry');
      return;
    }

    console.log(`[Cache] Retrying ${this.failedItems.length} failed items...`);

    const itemsToRetry = [...this.failedItems];
    const stillFailedItems: FailedItem[] = [];
    let retrySuccessCount = 0;

    for (const failedItem of itemsToRetry) {
      try {
        let success = false;

        if (failedItem.type === 'image' && failedItem.subjectId) {
          await this.fetchBangumiImage(failedItem.subjectId);
          success = true;
          retrySuccessCount++;
          console.log(
            `[Cache] Retry success: image for ${failedItem.id} (${failedItem.subjectId})`
          );
        } else if (failedItem.type === 'pv' && failedItem.mediaId) {
          await this.fetchPvBvid(failedItem.mediaId);
          success = true;
          retrySuccessCount++;
          console.log(
            `[Cache] Retry success: PV for ${failedItem.id} (${failedItem.mediaId})`
          );
        } else if (failedItem.type === 'rss' && failedItem.rssUrl) {
          await this.fetchRssContent(failedItem.rssUrl);
          success = true;
          retrySuccessCount++;
          console.log(
            `[Cache] Retry success: RSS for ${failedItem.id} (${failedItem.rssUrl})`
          );
        }

        if (!success) {
          // 如果重试次数超过5次，放弃重试
          if (failedItem.retryCount >= 5) {
            console.log(
              `[Cache] Giving up retry for ${failedItem.type} ${failedItem.id} after ${failedItem.retryCount} attempts`
            );
          } else {
            stillFailedItems.push({
              ...failedItem,
              retryCount: failedItem.retryCount + 1,
              lastRetryTime: Date.now(),
            });
          }
        }
      } catch (error) {
        console.error(
          `[Cache] Retry failed for ${failedItem.type} ${failedItem.id}:`,
          error
        );

        // 如果重试次数超过5次，放弃重试
        if (failedItem.retryCount >= 5) {
          console.log(
            `[Cache] Giving up retry for ${failedItem.type} ${failedItem.id} after ${failedItem.retryCount} attempts`
          );
        } else {
          stillFailedItems.push({
            ...failedItem,
            retryCount: failedItem.retryCount + 1,
            lastRetryTime: Date.now(),
          });
        }
      }

      // 在每个重试之间添加延迟
      await new Promise((resolve) => setTimeout(resolve, 1000)); // RSS重试间隔更长
    }

    console.log(
      `[Cache] Retry completed: ${retrySuccessCount} successful, ${stillFailedItems.length} still failed`
    );

    // 更新失败项列表
    this.failedItems = stillFailedItems;

    // 如果还有失败项，继续调度重试
    if (this.failedItems.length > 0) {
      console.log(
        `[Cache] Scheduling next retry for ${this.failedItems.length} items in 1 minute`
      );
      this.scheduleRetry();
    } else {
      console.log('[Cache] All failed items have been successfully retried');
    }
  }

  // 手动触发缓存刷新（用于API调用）
  public async triggerCacheRefresh(): Promise<void> {
    const currentSeason = this.getCurrentSeason();
    console.log(
      `[Cache] Manual cache refresh triggered for current season (${currentSeason})`
    );
    await this.refreshAllCaches();
  }

  // 为特定番剧手动刷新缓存（不受季度限制）
  public async refreshItemCache(item: Item): Promise<void> {
    console.log(
      `[Cache] Manual cache refresh for specific item: ${item.title}`
    );

    const promises: Promise<any>[] = [];

    // 刷新图片缓存
    const subjectId = this.getBangumiSubjectId(item);
    if (subjectId) {
      promises.push(
        this.fetchBangumiImage(subjectId).catch((error) =>
          console.error(`Failed to refresh image for ${item.title}:`, error)
        )
      );
    }

    // 刷新 PV 缓存
    const mediaId = this.getBilibiliMediaId(item);
    if (mediaId) {
      promises.push(
        this.fetchPvBvid(mediaId).catch((error) =>
          console.error(`Failed to refresh PV for ${item.title}:`, error)
        )
      );
    }

    // 刷新 RSS 缓存
    const rssUrl = this.getMikanRssUrl(item);
    if (rssUrl) {
      promises.push(
        this.fetchRssContent(rssUrl).catch((error) =>
          console.error(`Failed to refresh RSS for ${item.title}:`, error)
        )
      );
    }

    await Promise.all(promises);
    console.log(
      `[Cache] Manual cache refresh completed for item: ${item.title}`
    );
  }

  // 获取当季度新番的缓存状态
  public getCurrentSeasonCacheStatus(): {
    season: string;
    totalItems: number;
    imageCached: number;
    pvCached: number;
    rssCached: number;
  } {
    const currentSeasonItems = this.getCurrentSeasonItems();
    const currentSeason = this.getCurrentSeason();

    let imageCached = 0;
    let pvCached = 0;
    let rssCached = 0;
    const now = Date.now();

    for (const item of currentSeasonItems) {
      // 检查图片缓存
      const subjectId = this.getBangumiSubjectId(item);
      if (subjectId && this.imageCache[subjectId]) {
        imageCached++;
      }

      // 检查PV缓存
      const mediaId = this.getBilibiliMediaId(item);
      if (mediaId && this.pvBvidCache[mediaId]) {
        pvCached++;
      }

      // 检查RSS缓存（未过期）
      const rssUrl = this.getMikanRssUrl(item);
      if (rssUrl && this.rssCache[rssUrl]) {
        const cached = this.rssCache[rssUrl];
        if (now - cached.timestamp < this.RSS_CACHE_EXPIRE_TIME) {
          rssCached++;
        }
      }
    }

    return {
      season: currentSeason,
      totalItems: currentSeasonItems.length,
      imageCached,
      pvCached,
      rssCached,
    };
  }

  // 停止缓存刷新调度器
  public stopCacheRefreshScheduler(): void {
    if (this.cacheRefreshTask) {
      this.cacheRefreshTask.stop();
      this.cacheRefreshTask = undefined;
      console.log('[Cache] Cache refresh scheduler stopped');
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
      console.log('[Cache] Retry timer cleared');
    }
  }

  // 获取当前失败项状态
  public getFailedItemsStatus(): { count: number; items: FailedItem[] } {
    return {
      count: this.failedItems.length,
      items: [...this.failedItems],
    };
  }

  // 添加公共的 getter 方法
  public get isRefreshingCache(): boolean {
    return this.isRefreshing;
  }

  get isLoaded(): boolean {
    return !!this.version;
  }

  private async read() {
    const statRes = await stat(this.dataPath);
    const newData = await fse.readJSON(this.dataPath);
    this.version = Math.floor(statRes.mtimeMs);
    this.data = { version: this.version, ...newData };
  }

  private process() {
    if (!this.data) return;
    const { items, siteMeta } = this.data;

    const seasons: Set<string> = new Set();
    const seasonIds: { [key: string]: string[] } = {};
    const noEndDateIds: string[] = [];
    const itemEntities: { [key: string]: Item } = {};
    for (const item of items) {
      const { begin, end } = item;
      const beginDate = moment(begin);
      const season = beginDate.format('YYYY[q]Q');
      seasons.add(season);
      if (!seasonIds[season]) {
        seasonIds[season] = [];
      }
      const id = generateItemID(item);
      item.id = generateItemID(item);
      if (!end) {
        noEndDateIds.push(id);
      }
      seasonIds[season].push(id);
      item.sites.sort(siteSortCompare);
      generatePinyinTitltes(item);
      itemEntities[id] = item;
    }
    this.seasons = Array.from<string>(seasons);
    this.seasonIds = seasonIds;
    this.noEndDateIds = noEndDateIds;
    this.itemEntities = itemEntities;

    // Sites
    const siteMap: SiteMap = {};
    for (const [siteName, site] of Object.entries(siteMeta)) {
      const { type } = site;
      if (!siteMap[type]) {
        siteMap[type] = {};
      }
      (siteMap[type] || {})[siteName] = site;
    }
    this.siteMap = siteMap;
  }

  private async loadImageCache() {
    try {
      const statRes = await stat(this.imageCachePath);
      const cacheExpireTime = Date.now() - this.CACHE_EXPIRE_TIME;
      if (statRes.mtimeMs < cacheExpireTime) {
        // 缓存过期，删除
        await fse.unlink(this.imageCachePath);
      } else {
        // 读取缓存
        const cacheData = await fse.readJSON(this.imageCachePath);
        this.imageCache = cacheData;
      }
    } catch (e) {
      // ignore
    }
  }

  private async saveImageCache() {
    try {
      await fse.writeJSON(this.imageCachePath, this.imageCache);
    } catch (e) {
      console.error('Failed to save image cache:', e);
    }
  }

  private async loadPvBvidCache() {
    try {
      const statRes = await stat(this.pvBvidCachePath);
      const cacheExpireTime = Date.now() - this.CACHE_EXPIRE_TIME;
      if (statRes.mtimeMs < cacheExpireTime) {
        // 缓存过期，删除
        await fse.unlink(this.pvBvidCachePath);
      } else {
        // 读取缓存
        const cacheData = await fse.readJSON(this.pvBvidCachePath);
        this.pvBvidCache = cacheData;
      }
    } catch (e) {
      // ignore
    }
  }

  private async savePvBvidCache() {
    try {
      await fse.writeJSON(this.pvBvidCachePath, this.pvBvidCache);
    } catch (e) {
      console.error('Failed to save PV bvid cache:', e);
    }
  }

  private getBangumiSubjectId(item: Item): string | null {
    const bangumiSite = item.sites.find((site) => site.site === 'bangumi');
    return bangumiSite?.id || null;
  }

  private getBilibiliMediaId(item: Item): string | null {
    const bilibiliSite = item.sites.find((site) => site.site === 'bilibili');
    return bilibiliSite?.id || null;
  }

  private async fetchBangumiImage(subjectId: string): Promise<string> {
    const cacheKey = subjectId;
    const now = Date.now();

    // 检查缓存
    if (
      this.imageCache[cacheKey] &&
      now - this.imageCache[cacheKey].timestamp < this.CACHE_EXPIRE_TIME
    ) {
      // 如果缓存中是默认图片，删除缓存并重新获取
      if (
        this.imageCache[cacheKey].url ===
        'https://lain.bgm.tv/img/no_icon_subject.png'
      ) {
        delete this.imageCache[cacheKey];
      } else {
        return this.imageCache[cacheKey].url;
      }
    }

    try {
      // 使用重定向URL直接获取图片URL
      const imageUrl = `${this.BANGUMI_API_BASE}/subjects/${subjectId}/image?type=large`;

      // 发送请求获取重定向的图片URL
      const response = await axios.get(imageUrl, {
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
        timeout: 5000,
        headers: {
          'User-Agent':
            'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
          Authorization: `Bearer ${process.env.BANGUMI_API_TOKEN || ''}`,
        },
      });

      const finalImageUrl =
        response.headers.location ||
        `https://lain.bgm.tv/img/no_icon_subject.png`;

      // 更新缓存（如果不是默认图片才缓存）
      if (finalImageUrl !== 'https://lain.bgm.tv/img/no_icon_subject.png') {
        this.imageCache[cacheKey] = {
          url: finalImageUrl,
          timestamp: now,
        };

        // 异步保存缓存，不阻塞
        this.saveImageCache().catch(console.error);
      }

      return finalImageUrl;
    } catch (error) {
      console.error(`Failed to fetch image for subject ${subjectId}:`, error);
      // 返回默认图片，但不缓存
      const defaultUrl = 'https://lain.bgm.tv/img/no_icon_subject.png';
      return defaultUrl;
    }
  }

  private async fetchSeasonIdFromBilibili(
    mediaId: string
  ): Promise<number | null> {
    try {
      // 第一步：调用B站官方API获取season_id
      const response = await axios.get<BilibiliMediaResponse>(
        `${this.BILIBILI_API_BASE}/pgc/review/user?media_id=${mediaId}`,
        {
          timeout: 5000,
          headers: {
            'User-Agent':
              'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
          },
        }
      );

      if (response.data.code === 0 && response.data.result?.media?.season_id) {
        return response.data.result.media.season_id;
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch season_id for media ${mediaId}:`, error);
      return null;
    }
  }

  private async fetchPvBvidFromBiliplus(
    seasonId: number
  ): Promise<string | null> {
    try {
      // 第二步：调用 biliplus API 获取PV信息
      const response = await axios.get<BiliplusResponse>(
        `${this.BILIPLUS_API_BASE}?season=${seasonId}`,
        {
          timeout: 5000,
          headers: {
            'User-Agent':
              'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
          },
        }
      );

      if (response.data.code === 0 && response.data.result?.section) {
        // 查找标题为 "PV" 的 section
        const pvSection = response.data.result.section.find(
          // (section) => section.title === 'PV' || section.title === 'PV1'
          (section) => section.title.includes('PV')
        );

        if (pvSection && pvSection.episodes && pvSection.episodes.length > 0) {
          // 获取第一个 episode 的 bvid
          const bvid = pvSection.episodes[0].bvid;

          if (bvid) {
            return bvid;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to fetch PV bvid for season ${seasonId}:`, error);
      return null;
    }
  }

  private async fetchPvBvid(mediaId: string): Promise<string | undefined> {
    const cacheKey = mediaId;
    const now = Date.now();

    // 检查缓存
    if (
      this.pvBvidCache[cacheKey] &&
      now - this.pvBvidCache[cacheKey].timestamp < this.CACHE_EXPIRE_TIME
    ) {
      return this.pvBvidCache[cacheKey].bvid;
    }

    try {
      // 第一步：通过media_id获取season_id
      const seasonId = await this.fetchSeasonIdFromBilibili(mediaId);

      if (!seasonId) {
        return undefined;
      }

      // 第二步：通过season_id获取PV bvid
      const bvid = await this.fetchPvBvidFromBiliplus(seasonId);

      if (bvid) {
        // 更新缓存
        this.pvBvidCache[cacheKey] = {
          bvid,
          timestamp: now,
        };

        // 异步保存缓存，不阻塞
        this.savePvBvidCache().catch(console.error);

        return bvid;
      }

      return undefined;
    } catch (error) {
      console.error(`Failed to fetch PV bvid for media ${mediaId}:`, error);
      return undefined;
    }
  }

  private async loadRssCache() {
    try {
      const statRes = await stat(this.rssCachePath);
      const cacheExpireTime = Date.now() - this.RSS_CACHE_EXPIRE_TIME;
      if (statRes.mtimeMs < cacheExpireTime) {
        // 缓存过期，删除
        await fse.unlink(this.rssCachePath);
      } else {
        // 读取缓存
        const cacheData = await fse.readJSON(this.rssCachePath);
        this.rssCache = cacheData;
      }
    } catch (e) {
      // ignore
    }
  }

  private async saveRssCache() {
    try {
      await fse.writeJSON(this.rssCachePath, this.rssCache);
    } catch (e) {
      console.error('Failed to save RSS cache:', e);
    }
  }

  private getMikanRssUrl(item: Item): string | null {
    const mikanSite = item.sites.find((site) => site.site === 'mikan');
    if (!mikanSite?.id) return null;

    // 构建RSS URL，这里使用默认的mikanani.me RSS地址
    return `https://mikanani.me/RSS/Bangumi?bangumiId=${mikanSite.id}`;
  }

  private async fetchRssContent(
    rssUrl: string
  ): Promise<RssContent | undefined> {
    const cacheKey = rssUrl;
    const now = Date.now();

    // 检查缓存
    if (
      this.rssCache[cacheKey] &&
      now - this.rssCache[cacheKey].timestamp < this.RSS_CACHE_EXPIRE_TIME
    ) {
      return this.rssCache[cacheKey].content;
    }

    try {
      console.log(`[RSS] Fetching RSS content from: ${rssUrl}`);

      const response = await axios.get(rssUrl, {
        timeout: 10000,
        headers: {
          'User-Agent':
            'bangumi-list-v3 (https://github.com/mercutio/bangumi-list-v3)',
        },
      });

      // 解析XML
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true,
      });

      const result = await parser.parseStringPromise(response.data);

      if (!result.rss || !result.rss.channel) {
        throw new Error('Invalid RSS format');
      }

      const channel = result.rss.channel;
      const items = Array.isArray(channel.item)
        ? channel.item
        : channel.item
        ? [channel.item]
        : [];

      const rssContent: RssContent = {
        title: channel.title || '',
        description: channel.description || '',
        link: channel.link || '',
        items: items.map((item: any) => ({
          title: item.title || '',
          description: item.description || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          guid: item.guid || undefined,
          enclosure: item.enclosure
            ? {
                url: item.enclosure.url || '',
                type: item.enclosure.type || '',
                length: item.enclosure.length || '',
              }
            : undefined,
        })),
      };

      // 更新缓存
      this.rssCache[cacheKey] = {
        content: rssContent,
        timestamp: now,
      };

      // 异步保存缓存，不阻塞
      this.saveRssCache().catch(console.error);

      console.log(
        `[RSS] Successfully fetched RSS content: ${rssContent.items.length} items`
      );
      return rssContent;
    } catch (error) {
      console.error(`Failed to fetch RSS content from ${rssUrl}:`, error);
      return undefined;
    }
  }

  // 获取RSS内容的公共方法
  public async getRssContent(rssUrl: string): Promise<RssContent | undefined> {
    return this.fetchRssContent(rssUrl);
  }

  // 获取番剧的RSS内容
  public async getItemRssContent(item: Item): Promise<RssContent | undefined> {
    const rssUrl = this.getMikanRssUrl(item);
    if (!rssUrl) return undefined;

    return this.fetchRssContent(rssUrl);
  }

  // 修改enrichItemsWithImages方法，只从缓存获取数据
  public async enrichItemsWithImages(items: Item[]): Promise<Item[]> {
    const enrichedItems = [...items];

    for (const item of enrichedItems) {
      // 只从缓存获取图片
      const subjectId = this.getBangumiSubjectId(item);
      if (subjectId && this.imageCache[subjectId]) {
        const cached = this.imageCache[subjectId];
        item.image = cached.url;
      }

      // 只从缓存获取 PV bvid
      const mediaId = this.getBilibiliMediaId(item);
      if (mediaId && this.pvBvidCache[mediaId]) {
        const cached = this.pvBvidCache[mediaId];
        item.previewEmbedLink = `https://player.bilibili.com/player.html?isOutside=true&bvid=${cached.bvid}&high_quality=1`;
      }

      // 只从缓存获取 RSS 内容
      const rssUrl = this.getMikanRssUrl(item);
      if (rssUrl && this.rssCache[rssUrl]) {
        const cached = this.rssCache[rssUrl];
        item.rssContent = cached.content;
      }
    }

    return enrichedItems;
  }

  // 修改update方法，在数据加载完成后触发初始缓存刷新
  public async update(force = true) {
    const newDataPath = this.dataPath + `.${Date.now()}`;
    let skip = false;
    await fse.ensureDir(this.dataFolderPath);
    if (!force) {
      try {
        await fse.access(this.dataPath, constants.R_OK);
        skip = true;
      } catch (e) {
        // ignore
      }
    }

    if (!skip) {
      const resp: AxiosResponse<Stream> = await axios({
        url: this.dataURL,
        method: 'GET',
        responseType: 'stream',
      });
      await new Promise((resolve) => {
        resp.data.on('end', async () => {
          await fse.rename(newDataPath, this.dataPath);
          resolve(undefined);
        });
        resp.data.pipe(fs.createWriteStream(newDataPath));
      });
    }

    await this.read();
    this.process();

    // 在数据加载完成后触发初始缓存刷新
    setTimeout(() => {
      this.initialCacheRefresh().catch(console.error);
    }, 1000); // 延迟1秒执行，确保其他初始化完成
  }
}

function generateItemID(item: Item): string {
  const { title, begin } = item;
  const beginDate = moment(begin);
  const idString = `${beginDate.format('YYYY-MM')}${title}`;
  return md5(idString);
}

function siteSortCompare(first: BangumiSite, second: BangumiSite): number {
  return first.site < second.site ? -1 : 1;
}

function generatePinyinTitltes(item: Item) {
  if (!item.titleTranslate || !item.titleTranslate['zh-Hans']) return;
  const pinyinTitles = [];
  for (const title of item.titleTranslate['zh-Hans']) {
    pinyinTitles.push(
      flatten(
        pinyin(title, {
          style: pinyin.STYLE_NORMAL,
        })
      ).join(''),
      flatten(
        pinyin(title, {
          style: pinyin.STYLE_FIRST_LETTER,
        })
      ).join('')
    );
  }
  item.pinyinTitles = pinyinTitles;
}

export default new BangumiModel();
