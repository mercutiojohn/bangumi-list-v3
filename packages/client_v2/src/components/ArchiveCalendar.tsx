import { useState } from "react";
import { useNavigate } from "react-router";
import { useSeasonList } from "@/hooks/useBangumi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface YearQuarterOptions {
  [key: string]: string[];
}

const quarterToMonth = (quarter: number): string => {
  const months = ['', '1', '4', '7', '10'];
  return months[quarter] || '';
};

const quarterNames = ['', '春季', '夏季', '秋季', '冬季'];

export function ArchiveCalendar() {
  const navigate = useNavigate();
  const { data: seasonData, isLoading, error } = useSeasonList();
  const [open, setOpen] = useState(false);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());

  if (isLoading || error || !seasonData) {
    return null;
  }

  const seasons = seasonData.items || [];
  const yearOptions: string[] = [];
  const yearQuarterOptions: YearQuarterOptions = {};

  // 解析季度数据
  for (const season of seasons) {
    const match = /^(\d{4})q(\d)$/.exec(season);
    if (!match) continue;
    const [, year, quarter] = match;
    if (!yearQuarterOptions[year]) {
      yearOptions.push(year);
      yearQuarterOptions[year] = [];
    }
    yearQuarterOptions[year].push(quarter);
  }

  // 排序年份（最新年份在前）
  yearOptions.sort((a, b) => parseInt(b) - parseInt(a));

  const handleSeasonClick = (season: string) => {
    navigate(`/archive/${season}`);
    setOpen(false);
  };

  const toggleYear = (year: string) => {
    const newExpandedYears = new Set(expandedYears);
    if (newExpandedYears.has(year)) {
      newExpandedYears.delete(year);
    } else {
      newExpandedYears.add(year);
    }
    setExpandedYears(newExpandedYears);
  };

  return (
    <div className="space-y-2 h-full overflow-y-auto">
      {yearOptions.map((year) => {
        const isExpanded = expandedYears.has(year);
        const quarters = yearQuarterOptions[year] || [];

        return (
          <Collapsible
            key={year}
            open={isExpanded}
            onOpenChange={() => toggleYear(year)}
          >
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-between p-3 h-auto"
              >
                <span className="text-base font-medium">{year}年</span>
                <div className="flex items-center gap-2">
                  {/* <span className="text-sm text-muted-foreground">
                    {quarters.length}季
                  </span> */}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent className="px-3 pb-2">
              <div className="grid grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((quarter) => {
                  const hasData = quarters.includes(quarter.toString());
                  const season = `${year}q${quarter}`;

                  return (
                    <Button
                      key={quarter}
                      variant={hasData ? "default" : "secondary"}
                      disabled={!hasData}
                      size="sm"
                      className={cn(
                        "h-12 flex flex-col gap-0.5",
                        !hasData && "opacity-50 cursor-not-allowed"
                      )}
                      onClick={() => hasData && handleSeasonClick(season)}
                    >
                      <span className="text-xs font-medium">
                        {quarterNames[quarter]}
                      </span>
                      <span className="text-xs opacity-80">
                        {quarterToMonth(quarter)}月
                      </span>
                    </Button>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
