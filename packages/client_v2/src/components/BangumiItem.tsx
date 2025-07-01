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

  // 详细的卡片内容（在 Dialog/Drawer 中展示）
  const cardDetail = (
    <div className={cn(
      "flex gap-6",
      "flex-col overflow-y-auto pb-4",
      isMobile && "mt-4",
    )}>
      {/* 番组图片 */}
      <div className={cn("flex-shrink-0")}>
        <div className="relative">
          {item.previewEmbedLink ? (
            <>
              <div className="aspect-video bg-gray-100 overflow-hidden">
                <iframe
                  src={item.previewEmbedLink}
                  className="w-full h-full border-0 user-select-none"
                  allowFullScreen
                  title={`${titleCN || item.title} PV`}
                />
              </div>
              {/* <div className="absolute inset-0 bg-black/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="bg-black/60 rounded-full p-2">
                <Play className="w-6 h-6 text-white fill-current" />
              </div>
            </div> */}
            </>
          ) : (
            <div className="flex items-center justify-center aspect-video bg-gray-100">
              {item.image ? (
                <img
                  src={item.image}
                  alt={titleCN || item.title}
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
        {/* 标题和在看按钮 */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className={cn(
              "font-semibold leading-tight mb-2 line-clamp-2",
              isMobile ? "text-lg" : "text-xl"
            )}>
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

            {/* 信息站点 */}
            <div className="flex gap-4">
              {item.officialSite && (
                <Button variant="link" size="sm" asChild className="px-0">
                  <a href={item.officialSite} rel="noopener" target="_blank" className="text-xs !text-muted-foreground inline-flex items-center gap-1 !p-0">
                    官网
                    <ExternalLink className="h-2 w-2" />
                  </a>
                </Button>
              )}
              {infoSites}
            </div>
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

        {/* 链接信息 - 使用 Popover */}
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
        <DrawerContent className="max-h-[90vh] p-0">
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
