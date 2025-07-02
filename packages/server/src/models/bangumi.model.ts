import cron, { ScheduledTask } from 'node-cron';
import moment from 'moment';
import md5 from 'md5';
import pinyin from 'pinyin';
import { flatten } from 'lodash';
import fs, { constants } from 'fs';
import fse from 'fs-extra';
import path from 'path';
import axios, { AxiosResponse } from 'axios';
import { Stream } from 'stream';
import { stat } from 'fs/promises';
import { DATA_DIR, DATA_FILE } from '../config';
import cacheService from '../services/cache.service';
import bilibiliService from '../services/bilibili.service';
import bangumiService from '../services/bangumi.service';
import rssService from '../services/mikanrss.service';
import {
  Item,
  BangumiSite,
  Data,
  SiteType,
  SiteItem,
} from 'bangumi-list-v3-shared';

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
  rssId?: string;
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
  private cacheRefreshTask?: ScheduledTask;
  private failedItems: FailedItem[] = [];
  private retryTimer?: NodeJS.Timeout;
  private isRefreshing = false;

  constructor() {
    this.dataFolderPath = DATA_DIR;
    this.dataPath = path.resolve(DATA_DIR, DATA_FILE);
  }

  // 获取当前季度
  private getCurrentSeason(): string {
    return moment().format('YYYY[q]Q');
  }

  // 获取上一季度
  private getPreviousSeason(): string {
    return moment().subtract(3, 'months').format('YYYY[q]Q');
  }

  // 判断是否为当季或上季番剧
  private isRecentSeasonItem(item: Item): boolean {
    const { begin } = item;
    const beginDate = moment(begin);
    const itemSeason = beginDate.format('YYYY[q]Q');
    const currentSeason = this.getCurrentSeason();
    const previousSeason = this.getPreviousSeason();
    return itemSeason === currentSeason || itemSeason === previousSeason;
  }

  // 获取当季和上季番剧列表
  private getRecentSeasonItems(): Item[] {
    if (!this.data) return [];
    return this.data.items.filter((item) => this.isRecentSeasonItem(item));
  }

  // 修改enrichItemsWithImages方法，只从缓存获取数据
  public async enrichItemsWithImages(items: Item[]): Promise<Item[]> {
    const enrichedItems = [...items];

    for (const item of enrichedItems) {
      // 只从缓存获取图片
      const subjectId = this.getBangumiSubjectId(item);
      if (subjectId) {
        const cached = cacheService.getImageCache(subjectId);
        if (cached && !cacheService.isExpired(cached.timestamp)) {
          item.image = cached.url;
        }
      }

      // 只从缓存获取 PV bvid
      const mediaId = this.getBilibiliMediaId(item);
      if (mediaId) {
        const cached = cacheService.getPvBvidCache(mediaId);
        if (cached && !cacheService.isExpired(cached.timestamp)) {
          item.previewEmbedLink = `https://player.bilibili.com/player.html?isOutside=true&bvid=${cached.bvid}&high_quality=1`;
        }
      }

      // 只从缓存获取 RSS 内容
      const rssId = this.getMikanRssId(item);
      if (rssId) {
        const cached = cacheService.getRssCache(rssId);
        if (cached && !cacheService.isExpired(cached.timestamp, true)) {
          item.rssContent = cached.content;
        }
      }
    }

    return enrichedItems;
  }

  // 启动缓存刷新调度器
  private startCacheRefreshScheduler() {
    // 每天凌晨2点执行缓存刷新
    this.cacheRefreshTask = cron.schedule(
      '0 2 * * *',
      async () => {
        const currentSeason = this.getCurrentSeason();
        const previousSeason = this.getPreviousSeason();
        console.log(
          `[Cache] Starting daily cache refresh for current and previous seasons (${currentSeason}, ${previousSeason})...`
        );
        try {
          await this.refreshAllCaches();
          console.log(
            `[Cache] Daily cache refresh for current and previous seasons (${currentSeason}, ${previousSeason}) completed successfully`
          );
        } catch (error) {
          console.error(
            `[Cache] Daily cache refresh for current and previous seasons (${currentSeason}, ${previousSeason}) failed:`,
            error
          );
        }
      },
      {
        timezone: 'Asia/Shanghai',
      }
    );

    console.log(
      '[Cache] Cache refresh scheduler started, will refresh current and previous season items daily at 2:00 AM'
    );
  }

  // 刷新所有缓存
  public async refreshAllCaches(): Promise<void> {
    if (this.isRefreshing) {
      console.log('[Cache] Cache refresh already in progress, skipping...');
      return;
    }

    this.isRefreshing = true;

    try {
      const recentSeasonItems = this.getRecentSeasonItems();
      const currentSeason = this.getCurrentSeason();
      const previousSeason = this.getPreviousSeason();

      console.log(`[Cache] Current season: ${currentSeason}`);
      console.log(`[Cache] Previous season: ${previousSeason}`);
      console.log(
        `[Cache] Found ${recentSeasonItems.length} items from current and previous seasons`
      );

      const CONCURRENT_LIMIT = 2;
      const chunks = [];
      for (let i = 0; i < recentSeasonItems.length; i += CONCURRENT_LIMIT) {
        chunks.push(recentSeasonItems.slice(i, i + CONCURRENT_LIMIT));
      }

      let processedCount = 0;
      let successCount = 0;
      let skippedCount = 0;
      const totalCount = recentSeasonItems.length;
      const currentFailedItems: FailedItem[] = [];

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (item) => {
            try {
              // 刷新图片缓存
              const subjectId = this.getBangumiSubjectId(item);
              if (subjectId) {
                const cached = cacheService.getImageCache(subjectId);
                if (cached && !cacheService.isExpired(cached.timestamp)) {
                  skippedCount++;
                } else {
                  const imageUrl = await bangumiService.fetchImage(subjectId);
                  if (
                    imageUrl !== 'https://lain.bgm.tv/img/no_icon_subject.png'
                  ) {
                    cacheService.setImageCache(subjectId, imageUrl);
                    successCount++;
                  }
                }
              }

              // 刷新 PV bvid 缓存
              const mediaId = this.getBilibiliMediaId(item);
              if (mediaId) {
                const cached = cacheService.getPvBvidCache(mediaId);
                if (cached && !cacheService.isExpired(cached.timestamp)) {
                  skippedCount++;
                } else {
                  const seasonId = await bilibiliService.fetchSeasonId(mediaId);
                  if (seasonId) {
                    const bvid = await bilibiliService.fetchPvBvid(seasonId);
                    if (bvid) {
                      cacheService.setPvBvidCache(mediaId, bvid);
                      successCount++;
                    }
                  }
                }
              }

              // 刷新 RSS 缓存
              const mikanId = this.getMikanId(item);
              if (mikanId) {
                const rssId = mikanId;
                const cached = cacheService.getRssCache(rssId);
                if (cached && !cacheService.isExpired(cached.timestamp, true)) {
                  skippedCount++;
                } else {
                  const content = await rssService.fetchContent(rssId);
                  if (content) {
                    cacheService.setRssCache(rssId, content);
                    successCount++;
                  }
                }
              }

              processedCount++;
            } catch (error) {
              console.error(
                `[Cache] Failed to process item ${item.title}:`,
                error
              );
              // 添加到失败项列表
              currentFailedItems.push({
                id: item.id || '',
                type: 'image',
                subjectId: this.getBangumiSubjectId(item) || undefined,
                mediaId: this.getBilibiliMediaId(item) || undefined,
                rssId: this.getMikanId(item) || undefined,
                retryCount: 0,
                lastRetryTime: Date.now(),
              });
            }
          })
        );

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      // 更新失败项列表并启动重试机制
      this.failedItems = currentFailedItems;
      if (this.failedItems.length > 0) {
        this.scheduleRetry();
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  // 获取站点ID的辅助方法
  private getBangumiSubjectId(item: Item): string | null {
    const bangumiSite = item.sites.find((site) => site.site === 'bangumi');
    return bangumiSite?.id || null;
  }

  private getBilibiliMediaId(item: Item): string | null {
    const bilibiliSite = item.sites.find((site) => site.site === 'bilibili');
    return bilibiliSite?.id || null;
  }

  private getMikanId(item: Item): string | null {
    const mikanSite = item.sites.find((site) => site.site === 'mikan');
    return mikanSite?.id || null;
  }
  // 获取Mikan RSS URL
  private getMikanRssId(item: Item): string | null {
    const mikanId = this.getMikanId(item);
    return mikanId;
  }

  // 获取Bangumi图片的包装方法
  private async fetchBangumiImage(subjectId: string): Promise<void> {
    const imageUrl = await bangumiService.fetchImage(subjectId);
    if (imageUrl !== 'https://lain.bgm.tv/img/no_icon_subject.png') {
      cacheService.setImageCache(subjectId, imageUrl);
    }
  }

  // 获取PV bvid的包装方法
  private async fetchPvBvid(mediaId: string): Promise<void> {
    const seasonId = await bilibiliService.fetchSeasonId(mediaId);
    if (seasonId) {
      const bvid = await bilibiliService.fetchPvBvid(seasonId);
      if (bvid) {
        cacheService.setPvBvidCache(mediaId, bvid);
      }
    }
  }

  // 获取RSS内容的包装方法
  private async fetchRssContent(rssId: string): Promise<void> {
    const content = await rssService.fetchContent(rssId);
    if (content) {
      cacheService.setRssCache(rssId, content);
    }
  }

  // 启动时初始刷新
  public async initialCacheRefresh(): Promise<void> {
    if (!this.data) {
      console.log('[Cache] No data loaded, skipping initial cache refresh');
      return;
    }

    const currentSeason = this.getCurrentSeason();
    const previousSeason = this.getPreviousSeason();
    console.log(
      `[Cache] Starting initial cache refresh for current and previous seasons (${currentSeason}, ${previousSeason}) on startup...`
    );
    try {
      await this.refreshAllCaches();
      console.log(
        `[Cache] Initial cache refresh for current and previous seasons (${currentSeason}, ${previousSeason}) completed successfully`
      );
    } catch (error) {
      console.error(
        `[Cache] Initial cache refresh for current and previous seasons (${currentSeason}, ${previousSeason}) failed:`,
        error
      );
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
        } else if (failedItem.type === 'rss' && failedItem.rssId) {
          await this.fetchRssContent(failedItem.rssId);
          success = true;
          retrySuccessCount++;
          console.log(
            `[Cache] Retry success: RSS for ${failedItem.id} (${failedItem.rssId})`
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
      await new Promise((resolve) => setTimeout(resolve, 1000));
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
    const previousSeason = this.getPreviousSeason();
    console.log(
      `[Cache] Manual cache refresh triggered for current and previous seasons (${currentSeason}, ${previousSeason})`
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
    const rssId = this.getMikanRssId(item);
    if (rssId) {
      promises.push(
        this.fetchRssContent(rssId).catch((error) =>
          console.error(`Failed to refresh RSS for ${item.title}:`, error)
        )
      );
    }

    await Promise.all(promises);
    console.log(
      `[Cache] Manual cache refresh completed for item: ${item.title}`
    );
  }

  // 获取当季和上季番剧的缓存状态
  public getRecentSeasonsCacheStatus(): {
    currentSeason: string;
    previousSeason: string;
    totalItems: number;
    currentSeasonItems: number;
    previousSeasonItems: number;
    imageCached: number;
    pvCached: number;
    rssCached: number;
  } {
    const recentSeasonItems = this.getRecentSeasonItems();
    const currentSeason = this.getCurrentSeason();
    const previousSeason = this.getPreviousSeason();

    let currentSeasonItems = 0;
    let previousSeasonItems = 0;
    let imageCached = 0;
    let pvCached = 0;
    let rssCached = 0;

    for (const item of recentSeasonItems) {
      const { begin } = item;
      const beginDate = moment(begin);
      const itemSeason = beginDate.format('YYYY[q]Q');

      if (itemSeason === currentSeason) {
        currentSeasonItems++;
      } else if (itemSeason === previousSeason) {
        previousSeasonItems++;
      }

      // 检查图片缓存
      const subjectId = this.getBangumiSubjectId(item);
      if (subjectId) {
        const cached = cacheService.getImageCache(subjectId);
        if (cached && !cacheService.isExpired(cached.timestamp)) {
          imageCached++;
        }
      }

      // 检查PV缓存
      const mediaId = this.getBilibiliMediaId(item);
      if (mediaId) {
        const cached = cacheService.getPvBvidCache(mediaId);
        if (cached && !cacheService.isExpired(cached.timestamp)) {
          pvCached++;
        }
      }

      // 检查RSS缓存
      const rssId = this.getMikanRssId(item);
      if (rssId) {
        const cached = cacheService.getRssCache(rssId);
        if (cached && !cacheService.isExpired(cached.timestamp, true)) {
          rssCached++;
        }
      }
    }

    return {
      currentSeason,
      previousSeason,
      totalItems: recentSeasonItems.length,
      currentSeasonItems,
      previousSeasonItems,
      imageCached,
      pvCached,
      rssCached,
    };
  }

  // 获取单个番剧的缓存状态
  public getItemCacheStatus(item: Item): {
    itemId: string;
    title: string;
    image: {
      cached: boolean;
      url?: string;
      subjectId?: string;
    };
    pv: {
      cached: boolean;
      embedLink?: string;
      mediaId?: string;
    };
    rss: {
      cached: boolean;
      content?: any;
      rssId?: string;
    };
  } {
    const subjectId = this.getBangumiSubjectId(item);
    const mediaId = this.getBilibiliMediaId(item);
    const rssId = this.getMikanRssId(item);

    // 检查图片缓存
    let imageCached = false;
    let imageUrl: string | undefined;
    if (subjectId) {
      const cached = cacheService.getImageCache(subjectId);
      if (cached && !cacheService.isExpired(cached.timestamp)) {
        imageCached = true;
        imageUrl = cached.url;
      }
    }

    // 检查PV缓存
    let pvCached = false;
    let embedLink: string | undefined;
    if (mediaId) {
      const cached = cacheService.getPvBvidCache(mediaId);
      if (cached && !cacheService.isExpired(cached.timestamp)) {
        pvCached = true;
        embedLink = `https://player.bilibili.com/player.html?isOutside=true&bvid=${cached.bvid}&high_quality=1`;
      }
    }

    // 检查RSS缓存
    let rssCached = false;
    let rssContent: any;
    if (rssId) {
      const cached = cacheService.getRssCache(rssId);
      if (cached && !cacheService.isExpired(cached.timestamp, true)) {
        rssCached = true;
        rssContent = cached.content;
      }
    }

    return {
      itemId: item.id || '',
      title: item.title,
      image: {
        cached: imageCached,
        url: imageUrl,
        subjectId: subjectId || undefined,
      },
      pv: {
        cached: pvCached,
        embedLink: embedLink,
        mediaId: mediaId || undefined,
      },
      rss: {
        cached: rssCached,
        content: rssContent,
        rssId: rssId || undefined,
      },
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

  // 修改 update 方法
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

    // 初始化缓存服务
    await cacheService.init();

    // 启动缓存刷新调度器
    this.startCacheRefreshScheduler();

    // 延迟执行初始缓存刷新
    setTimeout(() => {
      this.refreshAllCaches().catch(console.error);
    }, 1000);
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
