import { useState } from "react";
import { ActivityStats } from "@/components/activity-log/ActivityStats";
import { ActivityFilters } from "@/components/activity-log/ActivityFilters";
import { ActivityTable } from "@/components/activity-log/ActivityTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export default function ActivityLog() {
  const [filters, setFilters] = useState({});
  const isMobile = useIsMobile();

  return (
    <div className={cn(
      "mx-auto space-y-6",
      isMobile ? "p-4 py-6" : "container py-6"
    )}>
      <div>
        <h1 className={cn(
          "font-bold mb-2",
          isMobile ? "text-xl" : "text-3xl"
        )}>Lịch sử chỉnh sửa</h1>
        <p className={cn(
          "text-muted-foreground",
          isMobile ? "text-sm" : "text-base"
        )}>
          Theo dõi tất cả các hoạt động trong hệ thống
        </p>
      </div>

      <ActivityStats />

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFilters onFilterChange={setFilters} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hoạt động</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTable filters={filters} />
        </CardContent>
      </Card>
    </div>
  );
}
