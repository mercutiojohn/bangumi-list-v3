import { useState } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Eye, EyeOff, User as UserIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useUser, useUserActions } from "@/hooks";

const PASSWORD_MIN_LENGTH = 6;

const updatePasswordSchema = z.object({
  oldPassword: z.string().min(1, "请输入原密码"),
  newPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `新密码至少需要 ${PASSWORD_MIN_LENGTH} 位`),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "两次输入的新密码不一致",
  path: ["confirmPassword"],
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export default function UserCenterPage() {
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const user = useUser();
  const { updateUser, logout } = useUserActions();

  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Redirect if not logged in
  if (!user.isLogin) {
    navigate("/login");
    return null;
  }

  const onSubmit = async (values: UpdatePasswordFormValues) => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateUser({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      setSuccess(true);
      form.reset();
      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (err) {
      console.error("Update password error:", err);
      setError("密码修改失败，请检查原密码是否正确");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl p-4 space-y-6">
      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            用户信息
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">登录状态</Label>
              <div className="mt-1">
                <Badge variant="secondary">已登录</Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">邮箱地址</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label className="text-sm font-medium">用户ID</Label>
              <p className="mt-1 text-sm text-muted-foreground font-mono">
                {user.id}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" onClick={handleLogout}>
            登出
          </Button>
        </CardFooter>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
          <CardDescription>
            为了账户安全，建议定期更换密码
          </CardDescription>
        </CardHeader>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {/* Old Password Field */}
            <div className="space-y-2">
              <Label htmlFor="oldPassword">原密码</Label>
              <div className="relative">
                <Input
                  id="oldPassword"
                  type={showOldPassword ? "text" : "password"}
                  placeholder="请输入原密码"
                  {...form.register("oldPassword")}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  disabled={loading}
                >
                  {showOldPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {form.formState.errors.oldPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.oldPassword.message}
                </p>
              )}
            </div>

            {/* New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">新密码</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="请输入新密码"
                  {...form.register("newPassword")}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  disabled={loading}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {form.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                最短{PASSWORD_MIN_LENGTH}位的半角英文或者数字
              </p>
            </div>

            {/* Confirm New Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">确认新密码</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="请再次输入新密码"
                  {...form.register("confirmPassword")}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>密码修改成功，即将跳转到首页...</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存修改
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
