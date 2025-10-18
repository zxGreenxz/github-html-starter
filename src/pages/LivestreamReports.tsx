import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Edit, Trash2, BarChart3, CalendarIcon, Filter } from "lucide-react";
import { CreateLivestreamReportDialog } from "@/components/livestream-reports/CreateLivestreamReportDialog";
import { EditLivestreamReportDialog } from "@/components/livestream-reports/EditLivestreamReportDialog";
import { toast } from "@/hooks/use-toast";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isSameDay, isWithinInterval } from "date-fns";
import { vi } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseTimeRangeForDisplay } from "@/lib/time-utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface LivestreamReport {
  id: string;
  report_date: string;
  morning_ad_cost: number;
  evening_ad_cost: number;
  morning_duration: string;
  evening_duration: string;
  morning_live_orders: number;
  evening_live_orders: number;
  total_inbox_orders: number;
}

const LivestreamReports = () => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [editingReport, setEditingReport] = React.useState<LivestreamReport | null>(null);
  const [fromDate, setFromDate] = React.useState<Date | undefined>();
  const [toDate, setToDate] = React.useState<Date | undefined>();
  const [datePreset, setDatePreset] = React.useState<string>("");
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["livestream-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("livestream_reports")
        .select("*")
        .order("report_date", { ascending: false });
      
      if (error) throw error;
      return data as LivestreamReport[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("livestream_reports")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livestream-reports"] });
      toast({
        title: "Thành công",
        description: "Đã xóa báo cáo thành công",
      });
    },
    onError: () => {
      toast({
        title: "Lỗi",
        description: "Có lỗi xảy ra khi xóa báo cáo",
        variant: "destructive",
      });
    },
  });

  // Handle date preset selection
  const handleDatePreset = (preset: string) => {
    setDatePreset(preset);
    const today = new Date();
    
    switch (preset) {
      case "today":
        setFromDate(startOfDay(today));
        setToDate(endOfDay(today));
        break;
      case "yesterday":
        const yesterday = subDays(today, 1);
        setFromDate(startOfDay(yesterday));
        setToDate(endOfDay(yesterday));
        break;
      case "this-week":
        setFromDate(startOfWeek(today, { weekStartsOn: 1 }));
        setToDate(endOfWeek(today, { weekStartsOn: 1 }));
        break;
      case "this-month":
        setFromDate(startOfMonth(today));
        setToDate(endOfMonth(today));
        break;
      default:
        setFromDate(undefined);
        setToDate(undefined);
    }
  };

  // Filter reports based on date range
  const filteredReports = reports.filter((report) => {
    if (!fromDate || !toDate) return true;
    
    const reportDate = new Date(report.report_date);
    return isWithinInterval(reportDate, { start: fromDate, end: toDate });
  });

  const handleDelete = (id: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa báo cáo này?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  return (
    <div className={cn(
      "mx-auto space-y-6",
      isMobile ? "p-4" : "container p-6"
    )}>
      <div className={cn(
        "flex items-center",
        isMobile ? "flex-col items-start gap-3 w-full" : "justify-between"
      )}>
        <div className="flex items-center gap-2">
          <BarChart3 className={isMobile ? "h-5 w-5" : "h-6 w-6"} />
          <h1 className={cn(
            "font-bold",
            isMobile ? "text-xl" : "text-2xl"
          )}>Báo Cáo Livestream</h1>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          size={isMobile ? "sm" : "default"}
          className={isMobile ? "w-full" : ""}
        >
          <Plus className="h-4 w-4 mr-2" />
          Thêm báo cáo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? "text-base" : "text-lg"}>
            Danh sách báo cáo
          </CardTitle>
          {isMobile ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Filter className="h-4 w-4 mr-2" />
                  Bộ lọc
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 mt-2">
                {/* Date pickers */}
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal text-xs",
                          !fromDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {fromDate ? format(fromDate, "dd/MM") : "Từ"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={setFromDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                          "justify-start text-left font-normal text-xs",
                          !toDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {toDate ? format(toDate, "dd/MM") : "Đến"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={setToDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                {/* Quick filters */}
                <Select value={datePreset} onValueChange={handleDatePreset}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Lọc nhanh" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hôm nay</SelectItem>
                    <SelectItem value="yesterday">Hôm qua</SelectItem>
                    <SelectItem value="this-week">Tuần này</SelectItem>
                    <SelectItem value="this-month">Tháng này</SelectItem>
                  </SelectContent>
                </Select>
                
                {(fromDate || toDate || datePreset) && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setFromDate(undefined);
                      setToDate(undefined);
                      setDatePreset("");
                    }}
                    className="w-full text-xs"
                  >
                    Xóa bộ lọc
                  </Button>
                )}
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              {/* Date Range Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Từ ngày:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] justify-start text-left font-normal",
                        !fromDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, "dd/MM/yyyy") : "Chọn ngày"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fromDate}
                      onSelect={setFromDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Đến ngày:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[140px] justify-start text-left font-normal",
                        !toDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, "dd/MM/yyyy") : "Chọn ngày"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={toDate}
                      onSelect={setToDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Preset Date Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Lọc nhanh:</span>
                <Select value={datePreset} onValueChange={handleDatePreset}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Chọn thời gian" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hôm nay</SelectItem>
                    <SelectItem value="yesterday">Hôm qua</SelectItem>
                    <SelectItem value="this-week">Tuần này</SelectItem>
                    <SelectItem value="this-month">Tháng này</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clear Filters */}
              {(fromDate || toDate || datePreset) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setFromDate(undefined);
                    setToDate(undefined);
                    setDatePreset("");
                  }}
                >
                  Xóa bộ lọc
                </Button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Ngày</TableHead>
                  <TableHead className="text-center">Tiền QC</TableHead>
                  <TableHead className="text-center">Thời Gian</TableHead>
                  <TableHead className="text-center">Số món Live</TableHead>
                  <TableHead className="text-center">Số món Inbox</TableHead>
                  <TableHead className="text-center">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : filteredReports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Không có báo cáo nào
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReports.map((report) => (
                    <React.Fragment key={report.id}>
                      {/* Morning row */}
                      <TableRow className="bg-muted/20">
                        <TableCell rowSpan={2} className="text-center font-medium border-r">
                          {format(new Date(report.report_date), "dd/MM/yyyy", { locale: vi })}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs">Sáng</Badge>
                            <span className="text-sm font-medium">
                              {formatCurrency(report.morning_ad_cost)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs">Sáng</Badge>
                            <div className="text-sm whitespace-pre-line leading-tight">
                              {(() => {
                                const timeData = parseTimeRangeForDisplay(report.morning_duration || "");
                                return timeData.timeRange !== "-" 
                                  ? `${timeData.timeRange}\n${timeData.duration}`
                                  : "-";
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="outline" className="text-xs">Sáng</Badge>
                            <span className="text-sm font-medium">
                              {report.morning_live_orders}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell rowSpan={2} className="text-center font-medium border-l">
                          <span className="text-lg font-bold text-primary">
                            {report.total_inbox_orders}
                          </span>
                        </TableCell>
                        <TableCell rowSpan={2} className="text-center border-l">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingReport(report)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(report.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Evening row */}
                      <TableRow className="bg-muted/10">
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Chiều</Badge>
                            <span className="text-sm font-medium">
                              {formatCurrency(report.evening_ad_cost)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Chiều</Badge>
                            <div className="text-sm whitespace-pre-line leading-tight">
                              {(() => {
                                const timeData = parseTimeRangeForDisplay(report.evening_duration || "");
                                return timeData.timeRange !== "-" 
                                  ? `${timeData.timeRange}\n${timeData.duration}`
                                  : "-";
                              })()}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <Badge variant="secondary" className="text-xs">Chiều</Badge>
                            <span className="text-sm font-medium">
                              {report.evening_live_orders}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CreateLivestreamReportDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      {editingReport && (
        <EditLivestreamReportDialog
          report={editingReport}
          open={!!editingReport}
          onOpenChange={(open) => !open && setEditingReport(null)}
        />
      )}
    </div>
  );
};

export default LivestreamReports;