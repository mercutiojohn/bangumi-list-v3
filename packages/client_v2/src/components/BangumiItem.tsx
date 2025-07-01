import type { Item, SiteMeta } from 'bangumi-list-v3-shared';
// import { SiteType } from 'bangumi-list-v3-shared'; // TODO: fix it
import { format, isSameQuarter } from 'date-fns';
import { get } from 'lodash';
import { Heart, Globe, Calendar, Clock, ExternalLink, Image, MoreHorizontal, Play } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getBroadcastTimeString, SiteType } from "@/lib/bangumi-utils";
import BangumiLinkItem from "./BangumiLinkItem";
import { useState } from 'react';

interface BangumiItemProps {
  className?: string;
  item: Item;
  siteMeta?: SiteMeta;
  isArchive?: boolean;
  isWatching?: boolean;
  onWatchingClick?: () => void;
}

export default function BangumiItem({
  className,
  item,
  siteMeta = {},
  isArchive = false,
  isWatching = false,
  onWatchingClick,
}: BangumiItemProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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

  for (const site of item.sites) {
    if (!siteMeta[site.site]) continue;

    const linkItem = (
      <BangumiLinkItem
        key={`${site.site}_${site.id}`}
        site={site}
        siteMeta={siteMeta}
      />
    );

    switch (siteMeta[site.site].type) {
      case SiteType.INFO:
        infoSites.push(linkItem);
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

  const handleCardClick = () => {
    setIsDialogOpen(true);
  };

  // 简化的卡片展示（用作 Dialog 触发器）
  const cardPreview = (
    <div
      className="flex flex-col gap-3 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={handleCardClick}
    >
      <div className="relative">
        {item.image ? (
          <img
            src={item.image}
            alt={titleCN || item.title}
            className="w-32 h-44 sm:w-40 sm:h-56 lg:w-48 lg:h-64 object-cover rounded-lg bg-gray-100 shadow-md"
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
            "w-32 h-44 sm:w-40 sm:h-56 lg:w-48 lg:h-64 bg-gray-100 rounded-lg flex items-center justify-center shadow-md",
            item.image ? "hidden" : "flex"
          )}
        >
          <Image className="w-12 h-12 text-gray-400" />
        </div>

        {/* PV 播放按钮指示器 */}
        {item.previewEmbedLink && (
          <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="bg-black/60 rounded-full p-2">
              <Play className="w-6 h-6 text-white fill-current" />
            </div>
          </div>
        )}
      </div>

      <div className="">
        <h3 className="font-semibold text-xl leading-tight mb-2 line-clamp-2">
          {titleCN || item.title}

          {!isArchive && isNew && (
            <Badge variant="secondary" className="ml-2 text-xs bg-orange-100 text-orange-800">
              NEW
            </Badge>
          )}
        </h3>
        {titleCN && (
          <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
            {item.title}
          </p>
        )}
      </div>
    </div>
  );

  // 详细的卡片内容（在 Dialog 中展示）
  const cardDetail = (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row gap-6">
        {/* 番组图片 */}
        <div className="flex-shrink-0">
          <div className="relative">
            {item.image ? (
              <img
                src={item.image}
                alt={titleCN || item.title}
                className="w-48 h-64 object-cover rounded-lg bg-gray-100 shadow-md"
                loading="lazy"
              />
            ) : (
              <div className="w-48 h-64 bg-gray-100 rounded-lg flex items-center justify-center shadow-md">
                <div className="w-12 h-12 text-gray-400">📺</div>
              </div>
            )}
          </div>
        </div>

        {/* 番组信息 - 右侧内容 */}
        <div className="flex-1 min-w-0 space-y-4 py-3 pr-3">
          {/* 标题和在看按钮 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-xl leading-tight mb-2 line-clamp-2">
                {titleCN || item.title}

                {!isArchive && isNew && (
                  <Badge variant="secondary" className="ml-2 text-xs bg-orange-100 text-orange-800">
                    NEW
                  </Badge>
                )}
              </h3>
              {titleCN && (
                <p className="text-sm text-muted-foreground line-clamp-1 mb-3">
                  {item.title}
                </p>
              )}
            </div>

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

          {/* 播放时间信息 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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

          {/* 链接信息 - 使用 Popover */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.officialSite && (
                <Button variant="link" size="sm" asChild className="h-auto p-1 text-sm">
                  <a href={item.officialSite} rel="noopener" target="_blank" className="inline-flex items-center gap-1">
                    官网
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
            </div>

            {(infoSites.length > 0 || onairSites.length > 0 || resourceSites.length > 0) && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 px-3">
                    <Globe className="h-4 w-4 mr-1" />
                    更多链接
                    <MoreHorizontal className="h-4 w-4 ml-1" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="end">
                  <div className="space-y-4">
                    {/* 信息站点 */}
                    {infoSites.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">信息</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {infoSites}
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
                        <div className="flex flex-wrap gap-1">
                          {onairSites}
                        </div>
                      </div>
                    )}

                    {/* 下载站点 */}
                    {resourceSites.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">下载</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {resourceSites}
                        </div>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {cardPreview}

      {/* 简易 Dialog 实现 */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsDialogOpen(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <button
              onClick={() => setIsDialogOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10"
            >
              ✕
            </button>
            {cardDetail}
          </div>
        </div>
      )}
    </>
  );
}
