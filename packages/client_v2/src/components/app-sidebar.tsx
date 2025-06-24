import { MENU_ITEMS, USER_MENU_ITEMS } from "@/config"
import { useUser, useUserActions } from "@/hooks"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { NavLink } from "react-router"
import { LogOut, User } from "lucide-react"

export function AppSidebar() {
  const user = useUser()
  const { logout } = useUserActions()

  const handleLogout = async () => {
    try {
      await logout()
      window.location.href = "/"
    } catch (err) {
      console.error("Logout error:", err)
    }
  }

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>番组放送</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MENU_ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.path}>
                      <item.icon />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>用户</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {user.isLogin ? (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/me">
                        <User />
                        <span>用户中心</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              ) : (
                <>
                  {USER_MENU_ITEMS.filter(item => item.path !== "/me").map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.path}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {user.isLogin && (
        <SidebarFooter>
          <div className="p-2 space-y-2">
            <div className="text-sm text-muted-foreground">
              已登录: {user.email}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              登出
            </Button>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  )
}
