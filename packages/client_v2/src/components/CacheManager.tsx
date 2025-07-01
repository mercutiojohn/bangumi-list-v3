import { useState } from 'react';
import { RefreshCw, Database, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCacheStatus, useBangumiActions } from '@/hooks/useBangumi';
import { toast } from 'sonner';

export function CacheManager() {
  const { data: cacheStatus, isLoading, mutate } = useCacheStatus();
  const { refreshCache } = useBangumiActions();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshCache = async () => {
    try {
      setIsRefreshing(true);
      await refreshCache();
      toast.success('缓存刷新已启动');
      await mutate(); // 刷新状态
    } catch (error) {
      toast.error('启动缓存刷新失败');
      console.error('Failed to refresh cache:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatLastRetryTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            缓存管理
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          缓存管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 缓存状态 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">缓存状态:</span>
              {cacheStatus?.isRefreshing ? (
                <Badge variant="outline" className="text-blue-600 border-blue-600">
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  刷新中
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  空闲
                </Badge>
              )}
            </div>
            {cacheStatus?.failedItems && cacheStatus.failedItems.count > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">失败项:</span>
                <Badge variant="destructive">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {cacheStatus.failedItems.count} 项
                </Badge>
              </div>
            )}
          </div>

          <Button
            onClick={handleRefreshCache}
            disabled={isRefreshing || cacheStatus?.isRefreshing}
            size="sm"
          >
            {(isRefreshing || cacheStatus?.isRefreshing) ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                刷新中
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                手动刷新
              </>
            )}
          </Button>
        </div>

        {/* 失败项详情 */}
        {cacheStatus?.failedItems && cacheStatus.failedItems.count > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  有 {cacheStatus.failedItems.count} 个缓存项刷新失败，系统将自动重试
                </p>
                <div className="space-y-1 text-xs">
                  {cacheStatus.failedItems.items.slice(0, 5).map((item, index) => (
                    <div key={`${item.id}-${item.type}-${index}`} className="flex items-center justify-between">
                      <span>
                        {item.type === 'image' ? '图片' : 'PV'}: {item.id}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          重试 {item.retryCount}/5
                        </Badge>
                        <span className="text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {formatLastRetryTime(item.lastRetryTime)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {cacheStatus.failedItems.items.length > 5 && (
                    <p className="text-muted-foreground">
                      还有 {cacheStatus.failedItems.items.length - 5} 项...
                    </p>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* 说明信息 */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 缓存每天凌晨2点自动刷新</p>
          <p>• 失败的项目会在1分钟后自动重试，最多重试5次</p>
          <p>• 手动刷新会立即启动缓存更新任务</p>
        </div>
      </CardContent>
    </>
  );
}
