import useSWR, { mutate } from 'swr';
import { apiClient } from '@/lib/api';
import type { Item, SiteMeta, OnAirData, SeasonData } from 'bangumi-list-v3-shared';

// 缓存状态接口
interface CacheStatus {
  isRefreshing: boolean;
  failedItems: {
    count: number;
    items: Array<{
      id: string;
      type: 'image' | 'pv';
      subjectId?: string;
      mediaId?: string;
      retryCount: number;
      lastRetryTime: number;
    }>;
  };
}

// 单个番剧缓存状态接口
interface ItemCacheStatus {
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
}

// SWR fetcher function with proper typing
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

// Hook for cache status
export const useCacheStatus = () => {
  const { data, error, isLoading, mutate } = useSWR<CacheStatus>(
    'bangumi/cache-status',
    fetcher,
    {
      refreshInterval: 5000, // 每5秒刷新一次
    }
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
    await apiClient.request<void>('POST', 'bangumi/update', undefined, undefined);
  };

  const refreshCache = async (): Promise<{ message: string }> => {
    return await apiClient.request<{ message: string }>('POST', 'bangumi/refresh-cache', undefined, undefined);
  };

  return {
    updateBangumi,
    refreshCache,
  };
};

// Hook for single item data (complete with RSS)
export const useItemData = (itemId: string | null) => {
  const { data, error, isLoading, mutate: mutateItem } = useSWR<Item>(
    itemId ? `bangumi/item/${itemId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      // 启用轮询以获取更新的缓存数据
      refreshInterval: (latestData) => {
        // 获取当前轮询次数
        const pollCountKey = `poll_count_${itemId}`;
        const currentCount = parseInt(sessionStorage.getItem(pollCountKey) || '0');

        // 如果没有 RSS 数据且轮询次数少于3次，每8秒轮询一次
        if (!latestData?.rssContent && currentCount < 3) {
          // 增加轮询计数
          sessionStorage.setItem(pollCountKey, String(currentCount + 1));
          return 8000;
        }

        // 有数据或轮询超过3次后停止轮询
        if (latestData?.rssContent || currentCount >= 3) {
          // 清除轮询计数
          sessionStorage.removeItem(pollCountKey);

          // 如果成功获取到 RSS 数据，刷新相关列表
          if (latestData?.rssContent) {
            // 刷新当前播放列表
            mutate('bangumi/onair');

            // 刷新归档列表（如果 item 有 begin 字段，计算其所属季度）
            if (latestData.begin) {
              const beginDate = new Date(latestData.begin);
              const year = beginDate.getFullYear();
              const month = beginDate.getMonth() + 1;
              const quarter = Math.ceil(month / 3);
              const season = `${year}q${quarter}`;
              mutate(`bangumi/archive/${season}`);
            }
          }
        }
        return 0;
      },
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate: mutateItem,
  };
};

// 修改原有的 useItemCache hook，保持向后兼容
export const useItemCache = (itemId: string | null) => {
  const { data, error, isLoading, mutate } = useSWR<ItemCacheStatus>(
    itemId ? `bangumi/item/${itemId}/cache` : null,
    fetcher,
    {
      refreshInterval: 6000,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
};

// Hook for item cache actions
export const useItemCacheActions = () => {
  const refreshItemCache = async (itemId: string): Promise<{ message: string; cache: ItemCacheStatus }> => {
    return await apiClient.request<{ message: string; cache: ItemCacheStatus }>(
      'POST',
      `bangumi/item/${itemId}/refresh-cache`,
      undefined,
      undefined
    );
  };

  return {
    refreshItemCache,
  };
};
