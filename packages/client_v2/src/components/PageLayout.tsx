import { cn } from "@/lib/utils";

export const PageLayout = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn(
      "relative h-[100vh] overflow-y-auto",
      className
    )}>
      {children}
    </div>
  );
}
