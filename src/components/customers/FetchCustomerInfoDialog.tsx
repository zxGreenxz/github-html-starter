import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Define TPOS Partner type based on the API response structure
interface TPOSPartnerDetail {
  Id: number;
  Name: string;
  Phone: string;
  Email: string;
  Address: string;
  Note: string;
  Status: string; // e.g., "Normal", "Warning", "Bomb"
  StatusText: string; // e.g., "Bình thường", "Cảnh báo", "Bom hàng"
  Addresses: Array<{
    Address: string;
    // ... other address fields
  }>;
  Phones: Array<{
    Number: string;
    // ... other phone fields
  }>;
  // ... other fields
}

// Define local Customer type (simplified for dialog use)
interface LocalCustomer {
  id: string;
  idkh: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  customer_status: string;
  info_status: "incomplete" | "complete" | "synced_tpos"; // Updated type
  facebook_id: string | null;
}

interface FetchCustomerInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string; // Supabase customer ID
  idkh: string; // TPOS customer ID
  onSuccess: () => void;
}

// Helper function to map status text (centralized here for consistency)
const mapStatusText = (statusText: string | null | undefined): string => {
  if (!statusText) return "Bình thường";

  const normalizedStatus = statusText.trim().toLowerCase();
  const statusMap: Record<string, string> = {
    normal: "Bình thường",
    bomb: "Bom hàng",
    warning: "Cảnh báo",
    wholesale: "Khách sỉ",
    danger: "Nguy hiểm",
    close: "Thân thiết",
    vip: "VIP",
    "thieu thong tin": "Thiếu thông tin",
    incomplete: "Cần thêm TT",
    "bình thường": "Bình thường",
    "bom hàng": "Bom hàng",
    "cảnh báo": "Cảnh báo",
    "khách sỉ": "Khách sỉ",
    "nguy hiểm": "Nguy hiểm",
    "thân thiết": "Thân thiết",
    "thiếu thông tin": "Thiếu thông tin",
    "cần thêm tt": "Cần thêm TT",
    "chưa có tt": "Chưa có TT",
  };
  return statusMap[normalizedStatus] || "Bình thường";
};

// Helper to map TPOS Status to info_status for 1-1 fetch
const mapTPOSStatusToInfoStatusForOneToOne = (
  tposStatus: string | null | undefined,
  hasPhone: boolean,
): "complete" | "incomplete" => {
  if (!tposStatus || !hasPhone) return "incomplete";
  const normalizedStatus = tposStatus.trim().toLowerCase();
  return normalizedStatus === "normal" ? "complete" : "incomplete";
};

export function FetchCustomerInfoDialog({
  open,
  onOpenChange,
  customerId,
  idkh,
  onSuccess,
}: FetchCustomerInfoDialogProps) {
  const queryClient = useQueryClient();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [overwriteMode, setOverwriteMode] = useState(false); // true = overwrite, false = merge (only update if empty)

  // Fetch current Supabase customer data
  const { data: supabaseCustomer, isLoading: isLoadingSupabase } =
    useQuery<LocalCustomer>({
      queryKey: ["customer-detail", customerId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("customers")
          .select("*")
          .eq("id", customerId)
          .single();
        if (error) throw error;
        return data as LocalCustomer;
      },
      enabled: open && !!customerId,
    });

  // Fetch TPOS customer data via Edge Function
  const {
    data: tposCustomer,
    isLoading: isLoadingTpos,
    refetch: refetchTposData,
  } = useQuery<TPOSPartnerDetail>({
    queryKey: ["tpos-customer-detail", idkh],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated.");

      const response = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-tpos-customer-detail`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idkh }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch TPOS data");
      }
      return (await response.json()) as TPOSPartnerDetail;
    },
    enabled: open && !!idkh,
    staleTime: 5 * 60 * 1000, // Cache TPOS data for 5 minutes
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedFields(new Set());
      setOverwriteMode(false);
    }
  }, [open]);

  // Map TPOS data to a consistent format for comparison
  const mappedTposData = useMemo(() => {
    if (!tposCustomer) return null;
    const hasPhone = !!tposCustomer.Phones?.[0]?.Number;
    return {
      customer_name: tposCustomer.Name || null,
      phone: tposCustomer.Phones?.[0]?.Number || null,
      email: tposCustomer.Email || null,
      address: tposCustomer.Addresses?.[0]?.Address || null,
      notes: tposCustomer.Note || null,
      customer_status: mapStatusText(tposCustomer.StatusText),
      info_status: mapTPOSStatusToInfoStatusForOneToOne(
        tposCustomer.Status,
        hasPhone,
      ), // Use 1-1 specific mapping
      facebook_id: null, // TPOS API doesn't provide Facebook ID directly here
    };
  }, [tposCustomer]);

  // Fields to display and their labels
  const fieldsConfig = useMemo(
    () => [
      { key: "customer_name", label: "Tên khách hàng" },
      { key: "phone", label: "Số điện thoại" },
      { key: "email", label: "Email" },
      { key: "address", label: "Địa chỉ" },
      { key: "notes", label: "Ghi chú" },
      { key: "customer_status", label: "Trạng thái KH" },
      { key: "info_status", label: "Trạng thái TT" },
    ],
    [],
  );

  const handleToggleField = (key: string, checked: boolean) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return newSet;
    });
  };

  const updateCustomerMutation = useMutation({
    mutationFn: async (updates: Partial<LocalCustomer>) => {
      if (!customerId) throw new Error("Customer ID is missing.");
      const { error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({
        queryKey: ["customer-detail", customerId],
      });
      queryClient.invalidateQueries({ queryKey: ["customers-count-normal"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-warning"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-bomb"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-vip"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-chuacott"] });
      queryClient.invalidateQueries({
        queryKey: ["customers-count-synced_tpos"],
      });
      toast.success("Đã cập nhật thông tin khách hàng thành công!");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(`Lỗi cập nhật: ${error.message}`);
    },
  });

  const handleUpdate = () => {
    if (!supabaseCustomer || !mappedTposData) {
      toast.error("Không có dữ liệu để cập nhật.");
      return;
    }

    const updates: Partial<LocalCustomer> = {};
    let hasChanges = false;

    fieldsConfig.forEach(({ key }) => {
      if (selectedFields.has(key)) {
        const tposValue = mappedTposData[key as keyof typeof mappedTposData];
        const supabaseValue = supabaseCustomer[key as keyof LocalCustomer];

        if (overwriteMode) {
          // Overwrite mode: always take TPOS value if selected
          if (tposValue !== supabaseValue) {
            updates[key as keyof LocalCustomer] = tposValue as any;
            hasChanges = true;
          }
        } else {
          // Merge mode: only update if Supabase field is empty/null
          if (
            (supabaseValue === null ||
              supabaseValue === "" ||
              (typeof supabaseValue === 'number' && supabaseValue === 0)) &&
            tposValue !== null &&
            tposValue !== ""
          ) {
            updates[key as keyof LocalCustomer] = tposValue as any;
            hasChanges = true;
          }
        }
      }
    });

    if (!hasChanges) {
      toast.info("Không có thay đổi nào được chọn hoặc cần cập nhật.");
      return;
    }

    updateCustomerMutation.mutate(updates);
  };

  const isLoading = isLoadingSupabase || isLoadingTpos;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Lấy thông tin khách hàng từ TPOS
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          </DialogTitle>
          <DialogDescription>
            Cập nhật thông tin cho khách hàng:{" "}
            <span className="font-semibold">
              {supabaseCustomer?.customer_name || "..."}
            </span>{" "}
            (IDKH: <span className="font-mono text-sm">{idkh}</span>)
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">
              Đang tải dữ liệu khách hàng...
            </p>
          </div>
        ) : !tposCustomer ? (
          <div className="flex flex-col items-center justify-center py-8">
            <AlertTriangle className="h-10 w-10 text-yellow-500" />
            <p className="mt-4 text-muted-foreground text-center">
              Không tìm thấy thông tin khách hàng với IDKH: {idkh} trên TPOS.
              <br />
              Vui lòng kiểm tra lại IDKH hoặc cấu hình TPOS Bearer Token/Cookie
              trong Settings.
            </p>
            <Button onClick={() => refetchTposData()} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <Label
                htmlFor="overwrite-mode"
                className="flex items-center gap-2 text-sm font-medium"
              >
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Chế độ ghi đè dữ liệu hiện có
              </Label>
              <Switch
                id="overwrite-mode"
                checked={overwriteMode}
                onCheckedChange={setOverwriteMode}
              />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">Chọn</TableHead>
                    <TableHead className="w-40">Trường thông tin</TableHead>
                    <TableHead>Dữ liệu từ TPOS</TableHead>
                    <TableHead>Dữ liệu hiện tại</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fieldsConfig.map(({ key, label }) => {
                    const tposValue =
                      mappedTposData?.[key as keyof typeof mappedTposData];
                    const supabaseValue =
                      supabaseCustomer?.[key as keyof LocalCustomer];
                    const isDifferent = tposValue !== supabaseValue;
                    const shouldSelectByDefault =
                      isDifferent &&
                      !overwriteMode &&
                      (supabaseValue === null ||
                        supabaseValue === "" ||
                        (typeof supabaseValue === 'number' && supabaseValue === 0));

                    return (
                      <TableRow
                        key={key}
                        className={cn(
                          isDifferent && "bg-blue-50/50 dark:bg-blue-950/20",
                        )}
                      >
                        <TableCell className="text-center">
                          <Checkbox
                            checked={
                              selectedFields.has(key) || shouldSelectByDefault
                            }
                            onCheckedChange={(checked: boolean) =>
                              handleToggleField(key, checked)
                            }
                            disabled={!isDifferent && !overwriteMode} // Disable if no difference and not in overwrite mode
                          />
                        </TableCell>
                        <TableCell className="font-medium">{label}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              isDifferent &&
                                "font-semibold text-blue-700 dark:text-blue-300",
                            )}
                          >
                            {tposValue === null || tposValue === ""
                              ? "-"
                              : String(tposValue)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              isDifferent && "text-muted-foreground",
                            )}
                          >
                            {supabaseValue === null || supabaseValue === ""
                              ? "-"
                              : String(supabaseValue)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={
                  updateCustomerMutation.isPending || selectedFields.size === 0
                }
              >
                {updateCustomerMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Đang cập nhật...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Cập nhật ({selectedFields.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
