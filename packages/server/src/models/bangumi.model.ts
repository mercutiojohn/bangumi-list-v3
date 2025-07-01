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
  type: 'image' | 'pv';
  subjectId?: string;
  mediaId?: string;
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
  private readonly CACHE_EXPIRE_TIME = 7 * 24 * 60 * 60 * 1000; // 7天过期
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
    this.loadImageCache();
    this.loadPvBvidCache();
    this.startCacheRefreshScheduler();
  }

  // 启动缓存刷新调度器
  private startCacheRefreshScheduler() {
    // 每天凌晨2点执行缓存刷新
    this.cacheRefreshTask = cron.schedule(
      '0 2 * * *',
      async () => {
        console.log('[Cache] Starting daily cache refresh...');
        try {
          await this.refreshAllCaches();
          console.log('[Cache] Daily cache refresh completed successfully');
        } catch (error) {
          console.error('[Cache] Daily cache refresh failed:', error);
        }
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    console.log(
      '[Cache] Cache refresh scheduler started, will run daily at 2:00 AM'
    );
  }

  // 启动时初始刷新
  public async initialCacheRefresh(): Promise<void> {
    if (!this.data) {
      console.log('[Cache] No data loaded, skipping initial cache refresh');
      return;
    }

    console.log('[Cache] Starting initial cache refresh on startup...');
    try {
      await this.refreshAllCaches();
      console.log('[Cache] Initial cache refresh completed successfully');
    } catch (error) {
      console.error('[Cache] Initial cache refresh failed:', error);
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

      const { items } = this.data;
      const CONCURRENT_LIMIT = 3; // 减少并发数以避免API限制
      const chunks = [];

      // 分批处理所有项目
      for (let i = 0; i < items.length; i += CONCURRENT_LIMIT) {
        chunks.push(items.slice(i, i + CONCURRENT_LIMIT));
      }

      let processedCount = 0;
      let successCount = 0;
      let skippedCount = 0;
      const totalCount = items.length;
      const currentFailedItems: FailedItem[] = [];

      console.log(
        `[Cache] Starting to refresh cache for ${totalCount} items...`
      );

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (item) => {
            try {
              // 刷新图片缓存 - 只有缓存中没有数据时才刷新
              const subjectId = this.getBangumiSubjectId(item);
              if (subjectId) {
                if (this.imageCache[subjectId]) {
                  // 缓存中已存在，跳过刷新
                  skippedCount++;
                  // console.log(
                  //   `[Cache] Skipping image refresh for ${item.title} (${subjectId}) - already cached`
                  // );
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
                  // 缓存中已存在，跳过刷新
                  skippedCount++;
                  // console.log(
                  //   `[Cache] Skipping PV refresh for ${item.title} (${mediaId}) - already cached`
                  // );
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

              processedCount++;
              if (processedCount % 50 === 0) {
                console.log(
                  `[Cache] Progress: ${processedCount}/${totalCount} items processed, ${successCount} successful, ${skippedCount} skipped`
                );
              }
            } catch (error) {
              console.error(
                `[Cache] Failed to process item ${item.title}:`,
                error
              );
            }
          })
        );

        // 在批次之间添加延迟，避免API限制
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(
        `[Cache] Cache refresh completed: ${processedCount}/${totalCount} items processed, ${successCount} successful, ${skippedCount} skipped, ${currentFailedItems.length} failed`
      );

      // 更新失败项列表
      this.failedItems = currentFailedItems;

      // 如果有失败项，启动重试机制
      if (this.failedItems.length > 0) {
        console.log(
          `[Cache] Starting retry mechanism for ${this.failedItems.length} failed items`
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

      // 在每个重试之间添加小延迟
      await new Promise((resolve) => setTimeout(resolve, 500));
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
    console.log('[Cache] Manual cache refresh triggered');
    await this.refreshAllCaches();
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

  // 修改enrichItemsWithImages方法，只从缓存获取数据
  public async enrichItemsWithImages(items: Item[]): Promise<Item[]> {
    const enrichedItems = [...items];

    for (const item of enrichedItems) {
      // 只从缓存获取图片
      const subjectId = this.getBangumiSubjectId(item);
      if (subjectId && this.imageCache[subjectId]) {
        const cached = this.imageCache[subjectId];
        // const now = Date.now();

        // 检查缓存是否过期
        // if (now - cached.timestamp < this.CACHE_EXPIRE_TIME) {
        item.image = cached.url;
        // }
      }

      // 只从缓存获取 PV bvid
      const mediaId = this.getBilibiliMediaId(item);
      if (mediaId && this.pvBvidCache[mediaId]) {
        const cached = this.pvBvidCache[mediaId];
        // const now = Date.now();

        // 检查缓存是否过期
        // if (now - cached.timestamp < this.CACHE_EXPIRE_TIME) {
        item.previewEmbedLink = `https://player.bilibili.com/player.html?isOutside=true&bvid=${cached.bvid}&high_quality=1`;
        // }
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
