import { useState, useMemo, useEffect } from "react";
import { useAppInit, useOnAirData, useSiteData, usePreference } from "@/hooks";
import {
  Top,
  WeekdayTab,
  BangumiItemTable,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  CacheManager
} from "@/components";
import {
  Weekday,
  searchFilter,
  weekdayFilter,
  newBangumiFilter,
  watchingFilter,
  itemSortCompare,
  hoistWatchingItems,
  SiteType
} from "@/lib/bangumi-utils";
import { Settings } from "lucide-react";

// 站点域名模板（复刻原client的逻辑）
const bangumiTemplates = {
  'bangumi.tv': 'https://bgm.tv/subject/{{id}}',
  'chii.in': 'https://chii.in/subject/{{id}}',
};

const mikanTemplates = {
  'mikanani.me': 'https://mikanani.me/Home/Bangumi/{{id}}',
  'mikanime.tv': 'https://mikanime.tv/Home/Bangumi/{{id}}',
};

function App() {
  // 初始化应用
  useAppInit();

  // 获取数据
  const { data: onairData, isLoading: onairLoading, error: onairError } = useOnAirData();
  const { data: siteData, isLoading: siteLoading, error: siteError } = useSiteData();

  // 获取偏好设置
  const { common, bangumi } = usePreference();

  // 本地状态
  const [currentTab, setCurrentTab] = useState<Weekday>(new Date().getDay());
  const [searchText, setSearchText] = useState<string>('');
  const [hoistWatchingIds, setHoistWatchingIds] = useState<string[]>([]);
  const [activeSiteFilter, setActiveSiteFilter] = useState<string>('');
  const [showCacheManager, setShowCacheManager] = useState<boolean>(false);

  const isInSearch = !!searchText;

  // 修改站点元数据，添加域名模板
  const modifiedSiteMeta = useMemo(() => {
    if (!siteData) return {};

    return {
      ...siteData,
      bangumi: {
        ...siteData.bangumi,
        urlTemplate: bangumiTemplates[common.bangumiDomain as keyof typeof bangumiTemplates] || bangumiTemplates['bangumi.tv'],
      },
      mikan: {
        ...siteData.mikan,
        urlTemplate: mikanTemplates[common.mikanDomain as keyof typeof mikanTemplates] || mikanTemplates['mikanani.me'],
      },
    };
  }, [siteData, common.bangumiDomain, common.mikanDomain]);

  // 获取可用的配信站点列表
  const availableSites = useMemo(() => {
    if (!siteData) return [];

    return Object.entries(siteData)
      .filter(([_, meta]) => meta.type === SiteType.ONAIR)
      .map(([id, meta]) => ({ id, name: meta.title }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [siteData]);

  // 配信站点筛选函数
  const siteFilter = (siteId: string) => (item: any) => {
    if (!siteId) return true;
    return item.sites.some((site: any) => site.site === siteId);
  };

  // 过滤和排序番组
  const filteredItems = useMemo(() => {
    const items = onairData?.items || [];
    if (!items.length) return [];

    let filteredItems = [];

    if (isInSearch) {
      // 搜索模式
      filteredItems = items.filter(searchFilter(searchText));
    } else {
      // 周几筛选
      filteredItems = items.filter(weekdayFilter(currentTab));

      // 应用偏好筛选
      if (common.watchingOnly) {
        filteredItems = filteredItems.filter(watchingFilter([...bangumi.watching]));
      } else if (common.newOnly) {
        filteredItems = filteredItems.filter(newBangumiFilter);
      }
    }

    // 配信站点筛选
    if (activeSiteFilter) {
      filteredItems = filteredItems.filter(siteFilter(activeSiteFilter));
    }

    // 排序
    filteredItems.sort(itemSortCompare);

    // 置顶在看的番组
    if (common.hoistWatching && hoistWatchingIds.length) {
      filteredItems = hoistWatchingItems(filteredItems, hoistWatchingIds);
    }

    return filteredItems;
  }, [
    onairData,
    isInSearch,
    searchText,
    currentTab,
    common.watchingOnly,
    common.newOnly,
    common.hoistWatching,
    bangumi.watching,
    hoistWatchingIds,
    activeSiteFilter,
  ]);

  // 更新置顶列表
  useEffect(() => {
    if (common.hoistWatching) {
      setHoistWatchingIds([...bangumi.watching]);
    } else {
      setHoistWatchingIds([]);
    }
  }, [currentTab, common.hoistWatching, bangumi.watching]);

  const handleTabClick = (tab: Weekday) => {
    setCurrentTab(tab);
  };

  const handleSearchInput = (text: string) => {
    setSearchText(text);
  };

  const handleSiteFilter = (site: string) => {
    setActiveSiteFilter(site);
  };

  // 加载状态
  if (onairLoading || siteLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (onairError || siteError) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-destructive">获取数据失败，请稍后重试</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题和管理按钮 */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-4">
          <h1 className="text-4xl font-bold">每日放送</h1>
          <button
            onClick={() => setShowCacheManager(!showCacheManager)}
            className="p-2 rounded-md hover:bg-gray-100 transition-colors"
            title="缓存管理"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <p className="text-muted-foreground">方便快捷的版权动画播放地址聚合站</p>
      </div>

      {/* 缓存管理器 */}
      {showCacheManager && (
        <CacheManager />
      )}

      {/* 搜索栏 */}
      <Top onSearchInput={handleSearchInput} />

      {/* 筛选设置状态 */}
      {(common.newOnly || common.watchingOnly || common.hoistWatching || activeSiteFilter) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">当前筛选设置</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {common.newOnly && (
                <Badge variant="secondary">仅显示新番</Badge>
              )}
              {common.watchingOnly && (
                <Badge variant="secondary">仅显示在看</Badge>
              )}
              {common.hoistWatching && (
                <Badge variant="secondary">置顶在看</Badge>
              )}
              {activeSiteFilter && (
                <Badge variant="secondary">
                  配信: {availableSites.find(s => s.id === activeSiteFilter)?.name || activeSiteFilter}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 周几选择和配信筛选 */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <WeekdayTab
          disabled={isInSearch}
          activated={currentTab}
          onClick={handleTabClick}
          onSiteFilter={handleSiteFilter}
          activeSiteFilter={activeSiteFilter}
          availableSites={availableSites}
        />

        {/* 数据统计 */}
        <div className="text-sm text-muted-foreground">
          {isInSearch ? (
            `搜索到 ${filteredItems.length} 部作品`
          ) : (
            `共 ${filteredItems.length} 部作品`
          )}
        </div>
      </div>

      {/* 番组列表 */}
      <BangumiItemTable
        items={filteredItems}
        siteMeta={modifiedSiteMeta}
        emptyText={isInSearch ? '无搜索结果' : '暂无番组'}
      />

      {/* 数据更新时间 */}
      {onairData?.updated && (
        <div className="text-center text-sm text-muted-foreground mt-8">
          数据更新时间: {new Date(onairData.updated).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  );
}

export default App;
