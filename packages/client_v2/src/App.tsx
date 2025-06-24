import { useAppInit, useUser, useOnAirData, useSiteData } from "@/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function App() {
  // Initialize app
  useAppInit();

  // Get user state
  const user = useUser();

  // Get bangumi data
  const { data: onairData, isLoading: onairLoading, error: onairError } = useOnAirData();
  const { data: siteData, isLoading: siteLoading, error: siteError } = useSiteData();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">番组放送 V2</h1>
        <p className="text-muted-foreground">使用 Vite + Tailwind + shadcn/ui 重构</p>
      </div>

      {/* User Status */}
      <Card>
        <CardHeader>
          <CardTitle>用户状态</CardTitle>
        </CardHeader>
        <CardContent>
          {user.isLogin ? (
            <div className="space-y-2">
              <Badge variant="secondary">已登录</Badge>
              <p>邮箱: {user.email}</p>
              <p>ID: {user.id}</p>
            </div>
          ) : (
            <Badge variant="outline">未登录</Badge>
          )}
        </CardContent>
      </Card>

      {/* Data Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>番组数据</CardTitle>
            <CardDescription>每日放送数据加载状态</CardDescription>
          </CardHeader>
          <CardContent>
            {onairLoading && <Badge variant="secondary">加载中...</Badge>}
            {onairError && <Badge variant="destructive">加载失败</Badge>}
            {onairData && (
              <div className="space-y-2">
                <Badge variant="default">加载成功</Badge>
                <p>番组数量: {onairData.items?.length || 0}</p>
                <p>更新时间: {onairData.updated ? new Date(onairData.updated).toLocaleString() : '未知'}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>站点数据</CardTitle>
            <CardDescription>播放平台元数据</CardDescription>
          </CardHeader>
          <CardContent>
            {siteLoading && <Badge variant="secondary">加载中...</Badge>}
            {siteError && <Badge variant="destructive">加载失败</Badge>}
            {siteData && (
              <div className="space-y-2">
                <Badge variant="default">加载成功</Badge>
                <p>站点数量: {Object.keys(siteData).length}</p>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(siteData).slice(0, 5).map(site => (
                    <Badge key={site} variant="outline" className="text-xs">
                      {site}
                    </Badge>
                  ))}
                  {Object.keys(siteData).length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{Object.keys(siteData).length - 5}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test API Connection */}
      <Card>
        <CardHeader>
          <CardTitle>API 连接测试</CardTitle>
          <CardDescription>验证与后端服务的连接状态</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm">
              测试登录接口
            </Button>
            <Button variant="outline" size="sm">
              测试数据接口
            </Button>
            <Button variant="outline" size="sm">
              测试偏好设置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
