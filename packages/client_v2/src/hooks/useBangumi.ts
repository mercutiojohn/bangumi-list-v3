import useSWR from 'swr';
import { apiClient } from '@/lib/api';
import type { Item, SiteMeta, OnAirData, SeasonData } from 'bangumi-list-v3-shared';

// SWR fetcher function
const fetcher = (url: string) => apiClient.request('GET', url);

// Hook for on-air bangumi data
export const useOnAirData = () => {
  const { data, error, isLoading, mutate } = useSWR<OnAirData>('bangumi/onair', fetcher);

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Hook for site metadata
export const useSiteData = () => {
  const { data, error, isLoading, mutate } = useSWR<SiteMeta>('bangumi/site', fetcher);

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Hook for season list (archive)
export const useSeasonList = () => {
  const { data, error, isLoading, mutate } = useSWR<SeasonData>('bangumi/season', fetcher);

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Hook for specific season archive data
export const useArchiveData = (season: string) => {
  const { data, error, isLoading, mutate } = useSWR<{ items: Item[] }>(
    season ? `bangumi/archive/${season}` : null,
    fetcher
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Hook for bangumi actions
export const useBangumiActions = () => {
  const updateBangumi = async (): Promise<void> => {
    await apiClient.request<void>('POST', 'bangumi/update', undefined, undefined, true);
  };

  return {
    updateBangumi,
  };
};
