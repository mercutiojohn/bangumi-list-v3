import { format, isSameQuarter } from 'date-fns';
import { get } from 'lodash';
import type { Item, SiteMeta } from 'bangumi-list-v3-shared';

// Weekday enum
export enum Weekday {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
  ALL = 7,
}

// Filter functions
export const searchFilter = (searchText: string) => (item: Item): boolean => {
  const titleCN = get(item, 'titleTranslate.zh-Hans[0]', '');
  const searchTarget = (titleCN || item.title).toLowerCase();
  return searchTarget.includes(searchText.toLowerCase());
};

export const weekdayFilter = (weekday: Weekday) => (item: Item): boolean => {
  if (weekday === Weekday.ALL) return true;
  return item.weekday === weekday;
};

export const newBangumiFilter = (item: Item): boolean => {
  const nowDate = new Date();
  const beginDate = new Date(item.begin);
  return isSameQuarter(nowDate, beginDate);
};

export const watchingFilter = (watchingList: string[]) => (item: Item): boolean => {
  return watchingList.includes(item.id);
};

// Sort function
export const itemSortCompare = (a: Item, b: Item): number => {
  // First by weekday
  if (a.weekday !== b.weekday) {
    return a.weekday - b.weekday;
  }

  // Then by broadcast time
  if (a.broadcast && b.broadcast) {
    return a.broadcast.localeCompare(b.broadcast);
  }

  // Finally by title
  const titleA = get(a, 'titleTranslate.zh-Hans[0]', a.title);
  const titleB = get(b, 'titleTranslate.zh-Hans[0]', b.title);
  return titleA.localeCompare(titleB);
};

// Hoist watching items to top
export const hoistWatchingItems = (items: Item[], watchingIds: string[]): Item[] => {
  const watchingItems = items.filter(item => watchingIds.includes(item.id));
  const nonWatchingItems = items.filter(item => !watchingIds.includes(item.id));
  return [...watchingItems, ...nonWatchingItems];
};

// Get broadcast time string
export const getBroadcastTimeString = (item: Item, siteMeta: SiteMeta = {}) => {
  const result = { jp: '', cn: '' };

  if (item.broadcast) {
    result.jp = item.broadcast;
  }

  // Get CN broadcast time from sites
  for (const site of item.sites) {
    const meta = siteMeta[site.site];
    if (meta?.broadcast) {
      result.cn = meta.broadcast;
      break;
    }
  }

  return result;
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
