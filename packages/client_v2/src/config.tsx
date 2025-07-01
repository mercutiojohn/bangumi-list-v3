import { Home, Settings, User, LogIn, UserPlus, Compass, Search, Newspaper } from "lucide-react"
import { createBrowserRouter } from "react-router";

import Layout from "./components/layout";
import BgmList from "./pages/BgmList";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import UserCenterPage from "./pages/UserCenterPage";
import ArchivePage from "./pages/ArchivePage";

export const ROUTER_ITEMS = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      {
        index: true,
        Component: BgmList,
      },
      {
        path: '/archive',
        Component: ArchivePage,
      },
      {
        path: "/login",
        Component: LoginPage,
      },
      {
        path: "/signup",
        Component: SignupPage,
      },
      {
        path: "/me",
        Component: UserCenterPage,
      },
    ],
  },
]);

export const MENU_ITEMS = [
  {
    title: "当季新番",
    path: "/",
    icon: Newspaper,
  },
  {
    title: "历史归档",
    path: "/archive",
    icon: Compass,
  },
]

export const USER_MENU_ITEMS = [
  {
    title: "登录",
    path: "/login",
    icon: LogIn,
  },
  {
    title: "注册",
    path: "/signup",
    icon: UserPlus,
  },
  {
    title: "用户中心",
    path: "/me",
    icon: User,
  },
]
