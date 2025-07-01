import { cn } from "@/lib/utils";
import { Weekday } from "@/lib/bangumi-utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tabItems: [Weekday, string][] = [
  [Weekday.MONDAY, '周一'],
  [Weekday.TUESDAY, '周二'],
  [Weekday.WEDNESDAY, '周三'],
  [Weekday.THURSDAY, '周四'],
  [Weekday.FRIDAY, '周五'],
  [Weekday.SATURDAY, '周六'],
  [Weekday.SUNDAY, '周日'],
];

interface WeekdayTabProps {
  activated?: Weekday;
  onClick?: (tab: Weekday) => void;
  disabled?: boolean;
  className?: string;
  // 新增配信筛选相关 props
  onSiteFilter?: (site: string) => void;
  activeSiteFilter?: string;
  availableSites?: Array<{ id: string; name: string }>;
}

export default function WeekdayTab({
  activated = Weekday.ALL,
  onClick,
  disabled = false,
  className,
  onSiteFilter,
  activeSiteFilter = '',
  availableSites = []
}: WeekdayTabProps) {
  const buttons = tabItems.map(([tab, text]) => {
    const isActivated = tab === activated;
    const isToday = new Date().getDay() === tab;
    const buttonText = isToday && tab !== Weekday.ALL ? '今天' : text;

    return (
      <Button
        key={tab}
        variant={isActivated ? "default" : "outline"}
        size="sm"
        disabled={disabled}
        onClick={() => onClick?.(tab)}
        className={cn(
          "transition-colors",
          isToday && !isActivated && "border-orange-500 text-orange-600 hover:bg-orange-50",
          isActivated && "shadow-sm"
        )}
      >
        {buttonText}
      </Button>
    );
  });

  const handleSiteChange = (value: string) => {
    // 将 "all" 转换为空字符串传递给父组件
    onSiteFilter?.(value === "all" ? "" : value);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* 周几选择 */}
      <div role="tablist" className="flex flex-wrap gap-2">
        {buttons}
        <Button
          variant={activated === Weekday.ALL ? "default" : "outline"}
          size="sm"
          disabled={disabled}
          onClick={() => onClick?.(Weekday.ALL)}
          className={cn(
            "transition-colors",
            activated === Weekday.ALL && "shadow-sm"
          )}
        >
          全部
        </Button>
      </div>

      {/* 配信站点筛选 */}
      {availableSites.length > 0 && false && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">配信筛选:</span>
          <Select
            value={activeSiteFilter || "all"}
            onValueChange={handleSiteChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="选择配信站点" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部站点</SelectItem>
              {availableSites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
