import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Outlet } from "react-router";

export default function Layout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="w-full h-full flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </SidebarProvider>
  )
}
