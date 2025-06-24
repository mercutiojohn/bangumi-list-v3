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

  constructor() {
    this.dataFolderPath = DATA_DIR;
    this.dataPath = path.resolve(DATA_DIR, DATA_FILE);
    this.imageCachePath = path.resolve(DATA_DIR, 'image-cache.json');
    this.pvBvidCachePath = path.resolve(DATA_DIR, 'pv-bvid-cache.json');
    this.loadImageCache();
    this.loadPvBvidCache();
  }

  get isLoaded(): boolean {
    return !!this.version;
  }

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

  public async enrichItemsWithImages(items: Item[]): Promise<Item[]> {
    const enrichedItems = [...items];

    // 并发获取图片和 PV bvid，但限制并发数量以避免过载
    const CONCURRENT_LIMIT = 5;
    const chunks = [];

    for (let i = 0; i < enrichedItems.length; i += CONCURRENT_LIMIT) {
      chunks.push(enrichedItems.slice(i, i + CONCURRENT_LIMIT));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (item) => {
          // 获取图片
          const subjectId = this.getBangumiSubjectId(item);
          if (subjectId) {
            try {
              item.image = await this.fetchBangumiImage(subjectId);
            } catch (error) {
              console.error(`Failed to get image for item ${item.id}:`, error);
              // 忽略错误，继续处理其他项目
            }
          }

          // 获取 PV bvid
          const mediaId = this.getBilibiliMediaId(item);
          if (mediaId) {
            try {
              const cachedBvid = await this.fetchPvBvid(mediaId);
              item.previewEmbedLink = `https://player.bilibili.com/player.html?isOutside=true&bvid=${cachedBvid}&high_quality=1`;
            } catch (error) {
              console.error(
                `Failed to get PV bvid for item ${item.id}:`,
                error
              );
              // 忽略错误，继续处理其他项目
            }
          }
        })
      );
    }

    return enrichedItems;
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
