import type { BangumiSite, SiteMeta } from 'bangumi-list-v3-shared';
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BangumiLinkItemProps {
  newTab?: boolean;
  site: BangumiSite;
  siteMeta?: SiteMeta;
  variant?: "link" | "ghost" | "default" | "secondary" | "destructive" | "outline" | null | undefined;
  size?: "default" | "sm" | "lg";
  className?: string;
}

export default function BangumiLinkItem({
  newTab = true,
  site,
  siteMeta = {},
  variant = "outline",
  size = "default",
  className
}: BangumiLinkItemProps) {
  const title = siteMeta[site.site]?.title ?? '未知';
  const urlTemplate = siteMeta[site.site]?.urlTemplate ?? '';
  const href = urlTemplate.replace(/\{\{id\}\}/g, site.id);
  const target = newTab ? '_blank' : '_self';

  if (!href) {
    return (
      <span className={cn("text-muted-foreground", className)}>
        {title}
      </span>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      asChild
      className={className}
    >
      <a
        href={href}
        rel="noopener"
        target={target}
        className={cn(
          "inline-flex items-center gap-1",
          variant === "link" ? "!px-0 text-xs !text-muted-foreground" : "",
        )}
      >
        {title}
        {newTab && variant === "link" && <ExternalLink className={cn(
          variant === "link" ? "h-2 w-2" : "h-3 w-3"
        )} />}
      </a>
    </Button>
  );
}
