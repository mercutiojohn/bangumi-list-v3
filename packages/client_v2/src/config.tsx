import { Home, Settings, User, LogIn, UserPlus } from "lucide-react"
import { createBrowserRouter } from "react-router";

import Layout from "./components/layout";
import BgmList from "./pages/BgmList";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import UserCenterPage from "./pages/UserCenterPage";

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
        path: '/list',
        Component: BgmList,
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
      // {
      //   path: "/settings",
      //   element: <div>Settings Page</div>,
      // }
    ],
  },
]);

export const MENU_ITEMS = [
  {
    title: "首页",
    path: "/",
    icon: Home,
  },
  // {
  //   title: "设置",
  //   path: "/settings",
  //   icon: Settings,
  // },
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
