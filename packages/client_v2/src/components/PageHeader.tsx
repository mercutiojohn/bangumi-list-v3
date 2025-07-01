import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarTrigger } from "./ui/sidebar";

interface PageHeaderProps {
  leftContent?: ReactNode;
  centerContent?: ReactNode;
  rightContent?: ReactNode;
  centerAtRight?: boolean;
  centerMobileBottom?: boolean;
  className?: string;
}

export const PageHeader = ({
  leftContent = (
    <div className="flex items-baseline gap-2">
      <h1 className="text-2xl font-semibold">标题</h1>
    </div>
  ),
  centerContent = (
    <></>
  ),
  rightContent = (
    <></>
  ),
  centerAtRight = false,
  centerMobileBottom = false,
  className = "",
}: PageHeaderProps) => {
  return (
    <>
      <div className={cn(
        `sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border z-50`,
        "flex items-center",
        className
      )}>
        <div className={cn(
          // "container mx-auto",
          "w-full",
          "px-4 py-3 flex flex-col gap-4"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              <SidebarTrigger />
              {leftContent}
            </div>

            <div className="flex gap-2">
              <div className={cn(
                "hidden xl:flex gap-2",
                !centerAtRight && "absolute left-1/2 -translate-x-1/2"
              )}>
                {centerContent}
              </div>
              {rightContent}
            </div>
          </div>

          {!centerMobileBottom && <div className="hidden max-xl:flex flex-col gap-2">
            <div className="flex gap-2">
              {centerContent}
            </div>
          </div>}
        </div>
      </div>
      {centerMobileBottom &&
        <div className={cn(
          `hidden max-xl:flex`,
          "sticky bottom-0",
          `w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border`,
        )}>
          <div className="container mx-auto px-4 py-3 flex flex-col gap-4">

            <div className="hidden max-xl:flex flex-col gap-2">
              <div className="flex gap-2">
                {centerContent}
              </div>
            </div>
          </div>
        </div>
      }
    </>
  );
}
