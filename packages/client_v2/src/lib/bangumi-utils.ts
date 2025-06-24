import { format, isSameQuarter } from 'date-fns';
import { get } from 'lodash';
import { Item, SiteMeta } from 'bangumi-list-v3-shared';

// Weekday enum
export const enum Weekday {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  ALL = 7,
}

// TODO: 临时的 SiteType 枚举定义，直到 shared 包的导入问题解决
export const enum SiteType {
  INFO = 'info',
  ONAIR = 'onair',
  RESOURCE = 'resource',
}

// Helper function to format broadcast string to time string
const broadcastToTimeString = (broadcast?: string, begin?: string): string => {
  let time = '';
  if (broadcast) {
    time = broadcast.split('/')[1];
  } else if (begin) {
    time = begin;
  }
  if (!time) return '';

  const date = new Date(time);
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[date.getDay()];
  const timeStr = format(date, 'HH:mm');

  return `${weekday} ${timeStr}`;
};

// Helper function to get broadcast date
export const getBroadcastDate = (item: Item): Date => {
  const { begin, broadcast } = item;
  if (broadcast) {
    return new Date(broadcast.split('/')[1]);
  }
  return new Date(begin);
};

// Get broadcast time string
export const getBroadcastTimeString = (item: Item, siteMeta: SiteMeta = {}) => {
  const result = { jp: '', cn: '' };

  // Get JP broadcast time
  result.jp = broadcastToTimeString(item.broadcast, item.begin);

  // Get CN broadcast time from item sites
  for (const site of item.sites) {
    if (site.broadcast) {
      result.cn = broadcastToTimeString(site.broadcast, item.begin);
      break;
    }
  }

  return result;
};

// Get broadcast time pretty-print string
export const getBroadcastTimePrettyString = (item: Item, siteMeta: SiteMeta = {}): string => {
  const broadcastTimes = getBroadcastTimeString(item, siteMeta);
  const parts: string[] = [];

  if (broadcastTimes.jp) {
    parts.push(`日本\n${broadcastTimes.jp}`);
  }

  if (broadcastTimes.cn) {
    parts.push(`大陆\n${broadcastTimes.cn}`);
  }

  return parts.join('\n');
};

// Filter functions
export const searchFilter = (searchText: string) => (item: Item): boolean => {
  const titleCN = get(item, 'titleTranslate.zh-Hans[0]', '');
  const searchTarget = Array.isArray(titleCN) ? titleCN[0] || '' : titleCN || item.title;
  return searchTarget.toLowerCase().includes(searchText.toLowerCase());
};

export const weekdayFilter = (weekday: Weekday) => (item: Item): boolean => {
  if (weekday === Weekday.ALL) return true;
  const broadcastWeekday = getBroadcastDate(item).getDay();
  return weekday === broadcastWeekday;
};

export const newBangumiFilter = (item: Item): boolean => {
  const nowDate = new Date();
  const beginDate = new Date(item.begin);
  return isSameQuarter(nowDate, beginDate);
};

export const watchingFilter = (watchingList: string[]) => (item: Item): boolean => {
  return item.id ? watchingList.includes(item.id) : false;
};

// Sort function
export const itemSortCompare = (a: Item, b: Item): number => {
  // First by weekday
  const aWeekday = getBroadcastDate(a).getDay();
  const bWeekday = getBroadcastDate(b).getDay();
  if (aWeekday !== bWeekday) {
    return aWeekday - bWeekday;
  }

  // Then by broadcast time
  if (a.broadcast && b.broadcast) {
    return a.broadcast.localeCompare(b.broadcast);
  }

  // Finally by title
  const titleA = get(a, 'titleTranslate.zh-Hans[0]', a.title);
  const titleB = get(b, 'titleTranslate.zh-Hans[0]', b.title);
  const titleAStr = Array.isArray(titleA) ? titleA[0] || a.title : titleA;
  const titleBStr = Array.isArray(titleB) ? titleB[0] || b.title : titleB;
  return titleAStr.localeCompare(titleBStr);
};

// Hoist watching items to top
export const hoistWatchingItems = (items: Item[], watchingIds: string[]): Item[] => {
  const watchingItems = items.filter(item => item.id && watchingIds.includes(item.id));
  const nonWatchingItems = items.filter(item => !item.id || !watchingIds.includes(item.id));
  return [...watchingItems, ...nonWatchingItems];
};

// Format season string
export const formatSeason = (season: string): string => {
  const match = /^(\d{4})q(\d)$/.exec(season);
  if (!match) return season;

  const [, year, quarter] = match;
  const months = ['', '1', '4', '7', '10'];
  return `${year}年${months[parseInt(quarter)]}月`;
};

// Quarter to month conversion
export const quarterToMonth = (quarter: number): string => {
  const months = ['', '1', '4', '7', '10'];
  return months[quarter] || '';
};
