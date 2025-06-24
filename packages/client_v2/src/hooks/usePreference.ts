import { useSnapshot } from 'valtio';
import { commonPreferenceStore, bangumiPreferenceStore, preferenceActions } from '@/stores/preference';
import { apiClient } from '@/lib/api';
import type { VersionedCommonPreference, VersionedBangumiPreference } from 'bangumi-list-v3-shared';

// Hook to access preference state
export const usePreference = () => {
  const common = useSnapshot(commonPreferenceStore);
  const bangumi = useSnapshot(bangumiPreferenceStore);

  return {
    common,
    bangumi,
  };
};

// Hook for preference actions
export const usePreferenceActions = () => {
  // Common preference operations
  const getCommonPreference = async (): Promise<VersionedCommonPreference> => {
    return await apiClient.request<VersionedCommonPreference>('GET', 'preference/common', undefined, undefined, true);
  };

  const updateCommonPreference = async (preference: VersionedCommonPreference): Promise<void> => {
    await apiClient.request<VersionedCommonPreference>('PATCH', 'preference/common', undefined, preference, true);
    preferenceActions.setCommonPreference(preference);
  };

  // Bangumi preference operations
  const getBangumiPreference = async (): Promise<VersionedBangumiPreference> => {
    return await apiClient.request<VersionedBangumiPreference>('GET', 'preference/bangumi', undefined, undefined, true);
  };

  const updateBangumiPreference = async (preference: VersionedBangumiPreference): Promise<void> => {
    await apiClient.request<VersionedBangumiPreference>('PATCH', 'preference/bangumi', undefined, preference, true);
    preferenceActions.setBangumiPreference(preference);
  };

  // Local storage operations (for non-logged users)
  const getCommonPreferenceLocal = (): VersionedCommonPreference | null => {
    try {
      const stored = localStorage.getItem('bangumi-list-v3-common-preference');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const updateCommonPreferenceLocal = (preference: VersionedCommonPreference): void => {
    localStorage.setItem('bangumi-list-v3-common-preference', JSON.stringify(preference));
    preferenceActions.setCommonPreference(preference);
  };

  const getBangumiPreferenceLocal = (): VersionedBangumiPreference | null => {
    try {
      const stored = localStorage.getItem('bangumi-list-v3-bangumi-preference');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  const updateBangumiPreferenceLocal = (preference: VersionedBangumiPreference): void => {
    localStorage.setItem('bangumi-list-v3-bangumi-preference', JSON.stringify(preference));
    preferenceActions.setBangumiPreference(preference);
  };

  // Toggle watching status for a bangumi item
  const toggleWatching = (itemId: string): void => {
    const currentWatching = bangumiPreferenceStore.watching;
    if (currentWatching.includes(itemId)) {
      preferenceActions.removeBangumiWatching(itemId);
    } else {
      preferenceActions.addBangumiWatching(itemId);
    }
  };

  return {
    // Actions
    ...preferenceActions,
    // API operations
    getCommonPreference,
    updateCommonPreference,
    getBangumiPreference,
    updateBangumiPreference,
    // Local operations
    getCommonPreferenceLocal,
    updateCommonPreferenceLocal,
    getBangumiPreferenceLocal,
    updateBangumiPreferenceLocal,
    // Bangumi watching operations
    toggleWatching,
  };
};
