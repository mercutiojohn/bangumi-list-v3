import type { Item, SiteMeta } from 'bangumi-list-v3-shared';
// import { SiteType } from 'bangumi-list-v3-shared'; // TODO: fix it
import { format, isSameQuarter } from 'date-fns';
import { get } from 'lodash';
import { Heart, Globe, Calendar, Clock, ExternalLink, Image, MoreHorizontal, Play } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { getBroadcastTimeString, SiteType } from "@/lib/bangumi-utils";
import BangumiLinkItem from "./BangumiLinkItem";
import { useState, useEffect } from 'react';
import { useItemData, useItemCache, useItemCacheActions } from "@/hooks/useBangumi";
import { parseRssTitle, groupRssItems, type ParsedRssItem } from "@/lib/rss-parser";

interface BangumiItemProps {
  className?: string;
  item: Item;
  siteMeta?: SiteMeta;
  isArchive?: boolean;
  isWatching?: boolean;
  size?: 'default' | 'square';
  onWatchingClick?: () => void;
}

export default function BangumiItem({
  className,
  item,
  siteMeta = {},
  isArchive = false,
  isWatching = false,
  size = 'default',
  onWatchingClick,
}: BangumiItemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showCacheInfo, setShowCacheInfo] = useState(false);

  // 使用新的单个番剧查询接口
  const { data: itemData, isLoading: itemLoading, mutate: mutateItemData } = useItemData(
    isDialogOpen && item.id ? item.id : null
  );

  // 保留缓存状态查询（用于缓存信息面板）
  const { data: cacheData, isLoading: cacheLoading, mutate: mutateCacheData } = useItemCache(
    showCacheInfo && item.id ? item.id : null
  );

  const { refreshItemCache } = useItemCacheActions();

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const broadcastTimeString = getBroadcastTimeString(item, siteMeta);
  const titleCN = get(item, 'titleTranslate.zh-Hans[0]', '') as string;
  const nowDate = new Date();
  const beginDate = new Date(item.begin);
  const beginString = format(beginDate, 'yyyy-MM-dd');
  const isNew = isSameQuarter(nowDate, beginDate);

  // 分类站点
  const infoSites: React.ReactNode[] = [];
  const onairSites: React.ReactNode[] = [];
  const resourceSites: React.ReactNode[] = [];

  // 使用完整的番剧数据或回退到列表数据
  const displayItem = itemData || item;
  const hasRssData = (displayItem.rssContent?.items?.length ?? 0) > 0;

  // RSS数据处理
  const rssItems: ParsedRssItem[] = [];
  for (const rss of displayItem.rssContent?.items || []) {
    const parsed = parseRssTitle(rss);
    parsed.link = rss.link;
    rssItems.push(parsed);
  }
  const groupedRssItems = groupRssItems(rssItems);

  for (const site of item.sites) {
    if (!siteMeta[site.site]) continue;

    const linkItem = (
      <BangumiLinkItem
        key={`${site.site}_${site.id}`}
        site={site}
        siteMeta={siteMeta}
      />
    );

    const infoItem = (
      <BangumiLinkItem
        key={`${site.site}_${site.id}`}
        site={site}
        siteMeta={siteMeta}
        variant={"link"}
        size={"sm"}
      />
    )

    switch (siteMeta[site.site].type) {
      case SiteType.INFO:
        infoSites.push(infoItem);
        break;
      case SiteType.RESOURCE:
        resourceSites.push(linkItem);
        break;
      case SiteType.ONAIR:
        onairSites.push(linkItem);
        break;
      default:
        continue;
    }
  }

  const handleWatchingClick = () => {
    onWatchingClick?.();
  };

  const handleCacheRefresh = async () => {
    if (!item.id) return;

    try {
      const result = await refreshItemCache(item.id);
      await mutateCacheData(result.cache);
      // 同时刷新完整的番剧数据
      await mutateItemData();
    } catch (error) {
      console.error('Failed to refresh cache:', error);
    }
  };

  const cardPreview = (
    <div className={cn(
      "flex flex-col gap-3 cursor-pointer hover:opacity-80 transition-opacity",
      className
    )}>
      <div className="relative">
        {item.image ? (
          <img
            src={item.image}
            alt={titleCN || item.title}
            className={cn(
              "w-full object-cover rounded-lg bg-gray-100",
              size === 'square' ? "aspect-square" : "aspect-[3/4]",
            )}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const placeholder = target.nextElementSibling as HTMLElement;
              if (placeholder) {
                placeholder.style.display = 'flex';
              }
            }}
          />
        ) : null}
        <div
          className={cn(
            "w-full bg-gray-100 rounded-lg flex items-center justify-center",
            size === 'square' ? "aspect-square" : "aspect-[3/4]",
            item.image ? "hidden" : "flex"
          )}
        >
          <Image className="w-12 h-12 text-gray-400" />
        </div>
      </div>

      <div className="">
        <h3 className="leading-tight mb-2 line-clamp-2">
          {titleCN || item.title}

          {!isArchive && isNew && (
            <Badge variant="secondary" className="ml-2 text-xs bg-orange-100 text-orange-800">
              NEW
            </Badge>
          )}
        </h3>
        {titleCN && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
            {item.title}
          </p>
        )}
      </div>
    </div>
  );

  // 详细的卡片内容
  const cardDetail = (
    <div className={cn(
      "flex gap-6",
      "flex-col overflow-y-auto pb-4",
      isMobile && "mt-4",
    )}>
      {/* 加载状态指示器 */}
      {itemLoading && (
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
            加载详细信息中...
          </div>
        </div>
      )}

      {/* 番组图片 */}
      <div className={cn("flex-shrink-0")}>
        <div className="relative">
          {displayItem.previewEmbedLink ? (
            <>
              <div className="aspect-video bg-gray-100 overflow-hidden">
                <iframe
                  src={displayItem.previewEmbedLink}
                  className="w-full h-full border-0 user-select-none"
                  allowFullScreen
                  title={`${titleCN || displayItem.title} PV`}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center aspect-video bg-gray-100">
              {displayItem.image ? (
                <img
                  src={displayItem.image}
                  alt={titleCN || displayItem.title}
                  className={cn(
                    "object-cover",
                    "rounded-lg bg-gray-100 shadow-md m-6",
                    isMobile ? "w-48 h-64" : "w-64 h-96",
                  )}
                  loading="lazy"
                />
              ) : (
                <div className={cn(
                  "flex items-center justify-center",
                  "rounded-lg bg-gray-100 shadow-md m-6",
                  isMobile ? "w-48 h-64" : "w-64 h-96",
                )}>
                  <Image className="w-12 h-12 text-gray-400" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 番组信息 */}
      <div className="flex-1 min-w-0 space-y-4 px-4">
        {/* 标题和按钮组 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold leading-tight mb-2 line-clamp-2",
              isMobile ? "text-lg" : "text-xl"
            )}>
              {titleCN || displayItem.title}

              {!isArchive && isNew && (
                <Badge variant="secondary" className="ml-2 text-xs bg-orange-100 text-orange-800">
                  NEW
                </Badge>
              )}
            </h3>
            {titleCN && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                {displayItem.title}
              </p>
            )}

            {/* 信息站点 */}
            <div className="flex gap-4">
              {displayItem.officialSite && (
                <Button variant="link" size="sm" asChild className="px-0">
                  <a href={displayItem.officialSite} rel="noopener" target="_blank" className="text-xs !text-muted-foreground inline-flex items-center gap-1 !p-0">
                    官网
                    <ExternalLink className="h-2 w-2" />
                  </a>
                </Button>
              )}
              {infoSites}
            </div>
          </div>

          <div className="flex gap-2">
            {/* 缓存信息按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCacheInfo(!showCacheInfo)}
              className="shrink-0"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">缓存信息</span>
            </Button>

            {!isArchive && (
              <Button
                variant={isWatching ? "default" : "outline"}
                size="sm"
                onClick={handleWatchingClick}
                className={cn(
                  "shrink-0 transition-colors",
                  isWatching && "bg-red-500 hover:bg-red-600 text-white"
                )}
              >
                <Heart className={cn("h-4 w-4", isWatching && "fill-current")} />
                <span className="sr-only">{isWatching ? '取消在看' : '在看'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* 缓存信息面板 */}
        {showCacheInfo && (
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">缓存状态</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCacheRefresh}
                disabled={!item.id}
              >
                刷新缓存
              </Button>
            </div>

            {cacheLoading ? (
              <div className="text-sm text-muted-foreground">加载中...</div>
            ) : cacheData ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-12">图片:</span>
                  <Badge variant={cacheData.image.cached ? "default" : "secondary"}>
                    {cacheData.image.cached ? "已缓存" : "未缓存"}
                  </Badge>
                  {cacheData.image.subjectId && (
                    <span className="text-xs text-muted-foreground">
                      ID: {cacheData.image.subjectId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12">PV:</span>
                  <Badge variant={cacheData.pv.cached ? "default" : "secondary"}>
                    {cacheData.pv.cached ? "已缓存" : "未缓存"}
                  </Badge>
                  {cacheData.pv.mediaId && (
                    <span className="text-xs text-muted-foreground">
                      ID: {cacheData.pv.mediaId}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-12">RSS:</span>
                  <Badge variant={cacheData.rss.cached ? "default" : "secondary"}>
                    {cacheData.rss.cached ? "已缓存" : "未缓存"}
                  </Badge>
                  {cacheData.rss.rssId && (
                    <span className="text-xs text-muted-foreground">
                      ID: {cacheData.rss.rssId}
                    </span>
                  )}
                </div>
                {cacheData.rss.cached && cacheData.rss.content && (
                  <div className="text-xs text-muted-foreground">
                    RSS条目: {cacheData.rss.content.items?.length || 0}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">无缓存数据</div>
            )}
          </div>
        )}

        {/* RSS资源状态指示 */}
        {!hasRssData && !itemLoading && displayItem.rssContent === null && (
          <div className="border rounded-lg p-3 bg-gray-50 border-gray-200">
            <div className="text-sm text-gray-600">
              该番组暂无RSS资源
            </div>
          </div>
        )}

        {!hasRssData && !itemLoading && displayItem.rssContent === undefined && (
          <div className="border rounded-lg p-3 bg-yellow-50 border-yellow-200">
            <div className="text-sm text-yellow-800">
              正在获取RSS资源信息...
            </div>
          </div>
        )}

        {/* 播放时间信息 */}
        <div className={cn(
          "grid gap-3 text-sm",
          isMobile ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"
        )}>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">日本</div>
              <div className="text-muted-foreground">
                {broadcastTimeString.jp || '暂无'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">大陆</div>
              <div className="text-muted-foreground">
                {broadcastTimeString.cn || '暂无'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <div className="font-medium">开播</div>
              <div className="text-muted-foreground">{beginString}</div>
            </div>
          </div>
        </div>

        {/* 链接信息 */}
        <div className="space-y-4">
          {/* 下载站点 */}
          {resourceSites.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">下载</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {resourceSites}
              </div>
            </div>
          )}

          {/* 配信站点 */}
          {onairSites.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">配信</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {onairSites}
              </div>
            </div>
          )}

          {/* RSS资源 */}
          {groupedRssItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Play className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">RSS资源</span>
              </div>
              <div className="space-y-3">
                {groupedRssItems.map(({ groupKey, items }) => {
                  const firstItem = items[0];
                  return (
                    <div key={groupKey} className="border rounded-lg p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-medium text-gray-900">
                          {firstItem.subGroup} - {firstItem.resolution}
                          {firstItem.source && ` (${firstItem.source})`}
                          {firstItem.language && ` [${firstItem.language}]`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {items.length} 集
                        </div>
                      </div>
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1">
                        {items.map((rssItem, index) => (
                          <a
                            key={index}
                            // href={`https://webtor.io/${rssItem.infoHash}` || rssItem.magnetLink || rssItem.originalItem.enclosure?.url || rssItem.link}
                            href={`https://webtor.io/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-center transition-colors"
                            title={rssItem.title}
                            onClick={(e) => {
                              e.preventDefault();
                              const magnetLink = rssItem.magnetLink || rssItem.originalItem.enclosure?.url || rssItem.link;
                              if (magnetLink) {
                                // 检查是否支持 Clipboard API
                                if (navigator.clipboard && window.isSecureContext) {
                                  navigator.clipboard.writeText(magnetLink).then(() => {
                                    window.open(`https://webtor.io/`, '_blank');
                                  }).catch(err => {
                                    console.error('复制失败:', err);
                                    // 降级到手动复制提示
                                    fallbackCopyToClipboard(magnetLink);
                                  });
                                } else {
                                  // 降级处理：使用传统方法或直接提示用户
                                  fallbackCopyToClipboard(magnetLink);
                                }
                              }
                            }}
                          >
                            {rssItem.episode ?
                              `${rssItem.episode}${rssItem.version || ''}` :
                              index + 1
                            }
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // 根据设备类型渲染不同的容器
  if (isMobile) {
    return (
      <Drawer open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DrawerTrigger asChild>
          {cardPreview}
        </DrawerTrigger>
        <DrawerContent className="p-0">
          {cardDetail}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        {cardPreview}
      </DialogTrigger>
      <DialogContent className="!max-w-4xl !w-full h-[90vh] overflow-hidden p-0 border-none">
        {cardDetail}
      </DialogContent>
    </Dialog>
  );
}

// 降级复制函数
const fallbackCopyToClipboard = (text: string) => {
  try {
    // 尝试使用传统的 document.execCommand 方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      window.open(`https://webtor.io/`, '_blank');
    } else {
      throw new Error('execCommand failed');
    }
  } catch (err) {
    console.error('复制失败:', err);
    // 最后降级：提示用户手动复制
    const userConfirmed = window.confirm(
      `无法自动复制链接，是否手动复制以下磁力链接？\n\n${text}\n\n点击确定打开 webtor.io`
    );
    if (userConfirmed) {
      window.open(`https://webtor.io/`, '_blank');
    }
  }
};
