import { useEffect, useRef } from 'react';
import type { Item, SiteMeta } from 'bangumi-list-v3-shared';
import { useUser, usePreference, usePreferenceActions } from '@/hooks';
import BangumiItem from './BangumiItem';
import { cn } from '@/lib/utils';

interface BangumiItemTableProps {
  items?: Item[];
  siteMeta?: SiteMeta;
  isArchive?: boolean;
  emptyText?: string;
  className?: string;
}

export default function BangumiItemTable({
  items = [],
  siteMeta = {},
  isArchive = false,
  emptyText = '暂无',
  className,
}: BangumiItemTableProps) {
  const { isLogin } = useUser();
  const { bangumi } = usePreference();
  const {
    updateBangumiPreference,
    updateBangumiPreferenceLocal,
    toggleWatching
  } = usePreferenceActions();

  const lastBangumiPreferenceVersion = useRef<number>(bangumi.version);

  // 自动保存偏好设置
  useEffect(() => {
    if (bangumi.version > lastBangumiPreferenceVersion.current) {
      if (isLogin) {
        updateBangumiPreference(bangumi).catch(console.error);
      } else {
        updateBangumiPreferenceLocal(bangumi);
      }
      lastBangumiPreferenceVersion.current = bangumi.version;
    }
  }, [bangumi.version, isLogin, bangumi, updateBangumiPreference, updateBangumiPreferenceLocal]);

  const handleWatchingClick = (itemId: string) => {
    toggleWatching(itemId);
  };

  if (!items.length) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <p className="text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {items.map((item) => {
        const id = item.id || '';
        const isWatching = bangumi.watching.includes(id);

        return (
          <BangumiItem
            key={item.id}
            item={item}
            siteMeta={siteMeta}
            isArchive={isArchive}
            isWatching={isWatching}
            onWatchingClick={() => handleWatchingClick(id)}
          />
        );
      })}
    </div>
  );
}
