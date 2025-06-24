import type { BangumiSite, SiteMeta } from 'bangumi-list-v3-shared';
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BangumiLinkItemProps {
  newTab?: boolean;
  site: BangumiSite;
  siteMeta?: SiteMeta;
  variant?: "default" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export default function BangumiLinkItem({
  newTab = true,
  site,
  siteMeta = {},
  variant = "link",
  size = "sm",
  className
}: BangumiLinkItemProps) {
  const title = siteMeta[site.site]?.title ?? '未知';
  const urlTemplate = siteMeta[site.site]?.urlTemplate ?? '';
  const href = urlTemplate.replace(/\{\{id\}\}/g, site.id);
  const target = newTab ? '_blank' : '_self';

  if (!href) {
    return (
      <span className={cn("text-muted-foreground text-sm", className)}>
        {title}
      </span>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      asChild
      className={cn("h-auto p-1 text-sm", className)}
    >
      <a
        href={href}
        rel="noopener"
        target={target}
        className="inline-flex items-center gap-1"
      >
        {title}
        {newTab && <ExternalLink className="h-3 w-3" />}
      </a>
    </Button>
  );
}
