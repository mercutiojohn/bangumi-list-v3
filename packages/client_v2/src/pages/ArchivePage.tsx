import { ArchiveCalendar } from "@/components";
import { PageHeader } from "@/components/PageHeader";
import { PageLayout } from "@/components/PageLayout";

export default function ArchivePage() {
  return (
    <PageLayout>
      <PageHeader
        leftContent={
          <h1 className="text-2xl font-bold">历史归档</h1>
        }
      />
      <div className="w-[300px] bg-muted h-full">
        <ArchiveCalendar />
      </div>
      <div className="flex-1">
        123
      </div>
    </PageLayout>
  );
}
