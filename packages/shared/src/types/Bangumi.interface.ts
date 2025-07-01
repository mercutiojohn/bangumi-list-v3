export enum SiteType {
  INFO = 'info',
  ONAIR = 'onair',
  RESOURCE = 'resource',
}

export interface SiteItem {
  title: string;
  urlTemplate: string;
  type: SiteType;
  regions?: string[];
}

export interface SiteMeta {
  [key: string]: SiteItem;
}

export enum BangumiType {
  TV = 'tv',
  WEB = 'web',
  MOVIE = 'movie',
  OVA = 'ova',
}

export interface BangumiSite {
  site: string;
  id: string;
  url?: string;
  begin?: string;
  broadcast?: string;
  comment?: string;
}

export interface TitleTranslate {
  [key: string]: string[];
}

export interface Item {
  id?: string;
  title: string;
  titleTranslate?: TitleTranslate;
  pinyinTitles?: string[];
  type: BangumiType;
  lang: string;
  officialSite: string;
  begin: string;
  broadcast?: string;
  end: string;
  comment?: string;
  sites: BangumiSite[];
  image?: string;
  previewEmbedLink?: string;
  rssContent?: RssContent;
}

export interface ItemList {
  items: Item[];
}

export interface Data {
  siteMeta: SiteMeta;
  items: Item[];
  version?: number;
}

export interface SeasonList {
  version: number;
  items: string[];
}

export interface OnAirData {
  items: Item[];
}

export interface SeasonData {
  version: number;
  items: string[];
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
