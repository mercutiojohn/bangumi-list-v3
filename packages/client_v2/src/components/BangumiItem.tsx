import type { Item, SiteMeta } from 'bangumi-list-v3-shared';
// import { SiteType } from 'bangumi-list-v3-shared'; // TODO: fix it
import { format, isSameQuarter } from 'date-fns';
import { get } from 'lodash';
import { Heart, Globe, Calendar, Clock, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBroadcastTimeString, SiteType } from "@/lib/bangumi-utils";
import BangumiLinkItem from "./BangumiLinkItem";

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
  const broadcastTimeString = getBroadcastTimeString(item, siteMeta);
  const titleCN = get(item, 'titleTranslate.zh-Hans[0]', '');
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

  return (
    <Card className={cn("transition-shadow hover:shadow-md", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg leading-tight mb-1 line-clamp-2">
              {titleCN || item.title}
            </h3>
            {titleCN && (
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {item.title}
              </p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {!isArchive && isNew && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                  NEW
                </Badge>
              )}
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
      </CardHeader>

      <CardContent className="space-y-4">
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

        {/* 链接信息 */}
        <div className="space-y-3">
          {/* 信息站点 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">信息</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {item.officialSite && (
                <Button variant="link" size="sm" asChild className="h-auto p-1 text-sm">
                  <a href={item.officialSite} rel="noopener" target="_blank" className="inline-flex items-center gap-1">
                    官网
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              )}
              {infoSites.length ? infoSites : !item.officialSite && (
                <span className="text-sm text-muted-foreground">暂无</span>
              )}
            </div>
          </div>

          {/* 配信站点 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">配信</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {onairSites.length ? onairSites : (
                <span className="text-sm text-muted-foreground">暂无</span>
              )}
            </div>
          </div>

          {/* 下载站点 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">下载</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {resourceSites.length ? resourceSites : (
                <span className="text-sm text-muted-foreground">暂无</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
