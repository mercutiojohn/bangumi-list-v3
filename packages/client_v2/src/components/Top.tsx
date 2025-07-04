import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";
import SearchInput from "./SearchInput";
import { cn } from "@/lib/utils";

interface TopProps {
  onSearchInput?: (text: string) => void;
  className?: string;
}

export default function Top({ onSearchInput, className }: TopProps) {
  return (
    <div className={cn("flex items-center gap-4 mb-6", className)}>
      <div className="flex-1">
        <SearchInput
          onSearchInput={onSearchInput}
          placeholder="搜索番组名称..."
        />
      </div>
    </div>
  );
}
