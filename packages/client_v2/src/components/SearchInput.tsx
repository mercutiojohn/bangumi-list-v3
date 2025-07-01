import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  onSearchInput?: (text: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export default function SearchInput({
  onSearchInput,
  placeholder = "搜索番组...",
  className,
  disabled = false
}: SearchInputProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    onSearchInput?.(value);
  }, [value, onSearchInput]);

  const handleClear = () => {
    setValue("");
  };

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className="pl-9 pr-9 bg-card"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-transparent"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">清除搜索</span>
        </Button>
      )}
    </div>
  );
}
