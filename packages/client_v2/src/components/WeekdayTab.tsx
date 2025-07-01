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
}

export default function WeekdayTab({
  activated = Weekday.ALL,
  onClick,
  disabled = false,
  className,
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

  return (
    <div className={cn("space-y-3", className)}>
      {/* 周几选择 */}
      <div className="flex flex-wrap gap-2">
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
        {buttons}
      </div>
    </div>
  );
}
