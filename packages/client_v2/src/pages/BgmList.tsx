import { useState, useMemo, useEffect } from "react";
import { useOnAirData, useSiteData, usePreference } from "@/hooks";
import {
  WeekdayTab,
  BangumiItemTable,
  Badge,
  CacheManager,
  SearchInput,
  ArchiveCalendar,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { PageLayout } from "@/components/PageLayout";

const bangumiTemplates = {
  'bangumi.tv': 'https://bgm.tv/subject/{{id}}',
  'chii.in': 'https://chii.in/subject/{{id}}',
};

const mikanTemplates = {
  'mikanani.me': 'https://mikanani.me/Home/Bangumi/{{id}}',
  'mikanime.tv': 'https://mikanime.tv/Home/Bangumi/{{id}}',
};

function BgmList() {
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

  const allItems = useMemo(() => {
    return onairData?.items || [];
  }
    , [onairData]);

  const searchItems = useMemo(() => {
    return allItems.filter(searchFilter(searchText));
  }
    , [allItems, searchText]);

  const dayItems = useMemo(() => {
    return allItems.filter(weekdayFilter(currentTab));
  }
    , [allItems, currentTab]);

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
    <PageLayout>
      <PageHeader
        leftContent={
          <div className="flex items-baseline gap-2">
            <h1 className="text-2xl font-semibold">当季新番</h1>
          </div>
        }
        centerContent={
          <SearchInput
            className="w-full xl:max-w-md"
            onSearchInput={handleSearchInput}
            placeholder="搜索番组名称..."
          />
        }
        rightContent={
          <Popover>
            <PopoverTrigger>
              <Button variant="outline">
                <Settings className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96">
              <CacheManager />
            </PopoverContent>
          </Popover>
        }
        centerAtRight
      />

      <div className="container mx-auto p-4 space-y-6">
        <h2 className="text-2xl font-bold">新番日历</h2>
        {/* 数据统计 */}
        <div className="text-xs text-muted-foreground">
          {isInSearch ? (
            `搜索到 ${dayItems.length} 部`
          ) : (
            `共 ${dayItems.length} 部`
          )}
        </div>
        <WeekdayTab
          disabled={false}
          activated={currentTab}
          onClick={handleTabClick}
        />
        <BangumiItemTable
          items={dayItems}
          siteMeta={modifiedSiteMeta}
          emptyText={`周${Weekday[currentTab]}暂无番组`}
          size="square"
        />

        <h2 className="text-2xl font-bold">全部番组</h2>
        {/* 数据统计 */}
        <div className="text-xs text-muted-foreground">
          {isInSearch ? (
            `搜索到 ${allItems.length} 部`
          ) : (
            `共 ${allItems.length} 部`
          )}
        </div>
        <BangumiItemTable
          items={allItems}
          siteMeta={modifiedSiteMeta}
          emptyText={isInSearch ? '无搜索结果' : '暂无番组'}
        />
        {/* 搜索结果列表 */}
        {isInSearch && (
          <BangumiItemTable
            items={searchItems}
            siteMeta={modifiedSiteMeta}
            emptyText="无搜索结果"
          />
        )}

        {/* 数据更新时间 */}
        {onairData?.updated && (
          <div className="text-center text-sm text-muted-foreground mt-8">
            数据更新时间: {new Date(onairData.updated).toLocaleString('zh-CN')}
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default BgmList;
