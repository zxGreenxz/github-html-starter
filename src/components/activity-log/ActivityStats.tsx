import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, Users, User } from "lucide-react";

export function ActivityStats() {
  const { data: stats } = useQuery({
    queryKey: ["activity-stats"],
    queryFn: async () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Total activities
      const { count: total } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true });

      // Today's activities
      const { count: todayCount } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .gte("created_at", today.toISOString());

      // Unique users
      const { data: usersData } = await supabase
        .from("activity_logs")
        .select("user_id");
      
      const uniqueUsers = new Set(usersData?.map(d => d.user_id).filter(Boolean)).size;

      // Current user's activities
      const { data: { user } } = await supabase.auth.getUser();
      const { count: myActivities } = await supabase
        .from("activity_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user?.id);

      return {
        total: total || 0,
        today: todayCount || 0,
        users: uniqueUsers,
        myActivities: myActivities || 0,
      };
    },
  });

  const statCards = [
    {
      title: "Tổng hoạt động",
      value: stats?.total || 0,
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Hôm nay",
      value: stats?.today || 0,
      icon: Clock,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Người dùng",
      value: stats?.users || 0,
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Của bạn",
      value: stats?.myActivities || 0,
      icon: User,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
