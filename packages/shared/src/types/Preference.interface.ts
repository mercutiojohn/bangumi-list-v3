export enum BangumiDomain {
  BANGUMI_TV = 'bangumi.tv',
  BGM_TV = 'bgm.tv',
  CHII_IN = 'chii.in',
}

export enum MikanDomain {
  MIKANANI_ME = 'mikanani.me',
  MIKANIME_TV = 'mikanime.tv',
  MIKANIME_ME_RSS = 'mikanani.me/rss',
  MIKANIME_TV_RSS = 'mikanime.tv/rss',
}

export interface CommonPreference {
  newOnly: boolean;
  watchingOnly: boolean;
  hoistWatching: boolean;
  bangumiDomain: BangumiDomain;
  mikanDomain: MikanDomain;
}

export interface VersionedCommonPreference extends CommonPreference {
  version: number;
  [key: string]: unknown;
}

export interface BangumiPreference {
  watching: string[];
}

export interface VersionedBangumiPreference extends BangumiPreference {
  version: number;
  [key: string]: unknown;
}
