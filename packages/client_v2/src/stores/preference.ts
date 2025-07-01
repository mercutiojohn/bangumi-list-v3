import { proxy } from 'valtio';
import type {
  VersionedCommonPreference,
  VersionedBangumiPreference,
  BangumiDomain,
  MikanDomain
} from 'bangumi-list-v3-shared';

// Common Preference Store
const initialCommonPreference: VersionedCommonPreference = {
  newOnly: false,
  watchingOnly: false,
  hoistWatching: false,
  bangumiDomain: 'bangumi.tv' as BangumiDomain,
  mikanDomain: 'mikanani.me' as MikanDomain,
  version: Date.now(),
};

export const commonPreferenceStore = proxy<VersionedCommonPreference>(initialCommonPreference);

// Bangumi Preference Store
const initialBangumiPreference: VersionedBangumiPreference = {
  watching: [],
  version: Date.now(),
};

export const bangumiPreferenceStore = proxy<VersionedBangumiPreference>(initialBangumiPreference);

export const preferenceActions = {
  setCommonPreference: (preference: VersionedCommonPreference) => {
    Object.assign(commonPreferenceStore, preference);
  },
  setBangumiPreference: (preference: VersionedBangumiPreference) => {
    Object.assign(bangumiPreferenceStore, preference);
  },
  updateCommonPreference: (updates: Partial<Omit<VersionedCommonPreference, 'version'>>) => {
    Object.assign(commonPreferenceStore, {
      ...updates,
      version: Date.now(),
    });
  },
  toggleWatching: (bangumiId: string) => {
    const watching = [...bangumiPreferenceStore.watching];
    const index = watching.indexOf(bangumiId);

    if (index >= 0) {
      watching.splice(index, 1);
    } else {
      watching.push(bangumiId);
    }

    bangumiPreferenceStore.watching = watching;
    bangumiPreferenceStore.version = Date.now();
  },
  addBangumiWatching: (bangumiId: string) => {
    const watching = [...bangumiPreferenceStore.watching];
    if (!watching.includes(bangumiId)) {
      watching.push(bangumiId);
      bangumiPreferenceStore.watching = watching;
      bangumiPreferenceStore.version = Date.now();
    }
  },
  removeBangumiWatching: (bangumiId: string) => {
    const watching = [...bangumiPreferenceStore.watching];
    const index = watching.indexOf(bangumiId);
    if (index >= 0) {
      watching.splice(index, 1);
      bangumiPreferenceStore.watching = watching;
      bangumiPreferenceStore.version = Date.now();
    }
  },
};
