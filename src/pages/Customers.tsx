import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Search,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  CloudDownload,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { formatVND } from "@/lib/currency-utils";
import { ImportCustomersDialog } from "@/components/customers/ImportCustomersDialog";
import { FetchCustomerInfoDialog } from "@/components/customers/FetchCustomerInfoDialog";
import { Progress } from "@/components/ui/progress";

type Customer = {
  id: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  customer_status: string;
  info_status: 'incomplete' | 'complete' | 'synced_tpos'; // Updated type
  total_orders: number;
  total_spent: number;
  facebook_id: string | null;
  idkh: string;
  created_at: string;
  updated_at: string;
};

type CustomerFormData = Omit<
  Customer,
  "id" | "created_at" | "updated_at" | "total_orders" | "total_spent" | "idkh"
> & { idkh?: string };

const statusColors: Record<string, string> = {
  "Bình thường":
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  "Bom hàng": "bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100",
  "Cảnh báo":
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  "Khách sỉ":
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  "Nguy hiểm": "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100",
  "Thân thiết": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  VIP: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  "Chưa có TT": "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
};

const statusLabels: Record<string, string> = {
  "Bình thường": "Bình thường",
  "Bom hàng": "Bom hàng",
  "Cảnh báo": "Cảnh báo",
  "Khách sỉ": "Khách sỉ",
  "Nguy hiểm": "Nguy hiểm",
  "Thân thiết": "Thân thiết",
  VIP: "VIP",
  "Chưa có TT": "Chưa có TT",
};

const mapStatusText = (statusText: string | null | undefined): string => {
  if (!statusText) return 'Bình thường';

  const normalizedStatus = statusText.trim().toLowerCase();

  const statusMap: Record<string, string> = {
    'normal': 'Bình thường', 'bomb': 'Bom hàng', 'warning': 'Cảnh báo',
    'wholesale': 'Khách sỉ', 'danger': 'Nguy hiểm', 'close': 'Thân thiết',
    'vip': 'VIP', 'thieu thong tin': 'Thiếu thông tin', 'incomplete': 'Cần thêm TT',
    'bình thường': 'Bình thường', 'bom hàng': 'Bom hàng', 'cảnh báo': 'Cảnh báo',
    'khách sỉ': 'Khách sỉ', 'nguy hiểm': 'Nguy hiểm', 'thân thiết': 'Thân thiết',
    'thiếu thông tin': 'Thiếu thông tin', 'cần thêm tt': 'Cần thêm TT',
    'chưa có tt': 'Chưa có TT',
  };

  if (statusMap[normalizedStatus]) {
    return statusMap[normalizedStatus];
  }

  console.warn(`[mapStatusText] Unknown status received: "${statusText}". Defaulting to "Bình thường".`);
  return 'Bình thường';
};

const infoStatusLabels: Record<string, string> = {
  complete: "Đầy đủ",
  incomplete: "Chưa có TT",
  synced_tpos: "Đã Sync TPOS", // New label
};

const infoStatusColors: Record<string, string> = {
  complete: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  incomplete: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100",
  synced_tpos: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100", // New color
};

// Helper to map TPOS Status to info_status (for 1-1 fetch)
const mapTPOSStatusToInfoStatusForOneToOne = (tposStatus: string | null | undefined, hasPhone: boolean): 'complete' | 'incomplete' => {
  if (!tposStatus || !hasPhone) return 'incomplete';
  const normalizedStatus = tposStatus.trim().toLowerCase();
  return normalizedStatus === 'normal' ? 'complete' : 'incomplete';
};


// Batch size for fetching TPOS data (internal to the loop, not the total count)
const TPOS_FETCH_BATCH_SIZE = 10;
const TPOS_FETCH_DELAY_MS = 500; // Delay between batches
const SUPABASE_UPSERT_BATCH_SIZE = 1000; // New: Batch size for Supabase upsert

export default function Customers() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>({
    customer_name: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    customer_status: "Bình thường",
    info_status: "incomplete",
    facebook_id: "",
    idkh: "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCustomersCount, setTotalCustomersCount] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportCustomersDialogOpen, setIsImportCustomersDialogOpen] = useState(false);

  const [isFetchCustomerInfoDialogOpen, setIsFetchCustomerInfoDialogOpen] = useState(false);
  const [customerToFetch, setCustomerToFetch] = useState<{ customerId: string; idkh: string } | null>(null);

  // New states for batch fetch
  const [isBatchFetchDialogOpen, setIsBatchFetchDialogOpen] = useState(false);
  const [isBatchFetching, setIsBatchFetching] = useState(false);
  const [batchFetchProgress, setBatchFetchProgress] = useState(0);
  const [batchFetchTotal, setBatchFetchTotal] = useState(0);
  const [batchFetchResults, setBatchFetchResults] = useState<Array<{ idkh: string; status: 'success' | 'failed'; message?: string }>>([]);
  const [batchFetchSuccessCount, setBatchFetchSuccessCount] = useState(0);
  const [batchFetchFailedCount, setBatchFetchFailedCount] = useState(0);
  const [maxCustomersToBatch, setMaxCustomersToBatch] = useState("100"); // New state for batch size

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers", searchTerm, statusFilter, currentPage, pageSize],
    queryFn: async () => {
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize - 1;

      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (searchTerm) {
        query = query.or(
          `customer_name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      if (statusFilter !== "all") {
        query = query.eq("customer_status", statusFilter);
      }

      query = query.range(start, end);

      const { data, count, error } = await query;

      if (error) throw error;
      setTotalCustomersCount(count || 0);
      return data as Customer[];
    },
  });

  // Query to get all customers that need fetching (idkh exists and not synced_tpos)
  const { data: allCustomersNeedingFetch = [], isLoading: isLoadingCustomersNeedingFetch } = useQuery({
    queryKey: ["all-customers-needing-fetch", maxCustomersToBatch], // Add maxCustomersToBatch to queryKey
    queryFn: async () => {
      const limit = parseInt(maxCustomersToBatch); // Get the limit from state
      console.log(`[Customers Page] Fetching allCustomersNeedingFetch with limit: ${limit}`); // Add this log
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .not("idkh", "is", null)
        .neq("info_status", "synced_tpos")
        .limit(limit); // Apply the limit here
      
      if (error) throw error;
      return data as Customer[];
    },
    staleTime: 0, // Always refetch when queryKey changes
  });

  const { data: totalNormalCount = 0, isLoading: isLoadingNormal } = useQuery({
    queryKey: ["customers-count-normal"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true }).eq("customer_status", "Bình thường")).count || 0,
  });
  const { data: totalWarningCount = 0, isLoading: isLoadingWarning } = useQuery({
    queryKey: ["customers-count-warning"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true }).eq("customer_status", "Cảnh báo")).count || 0,
  });
  const { data: totalBombCount = 0, isLoading: isLoadingBomb } = useQuery({
    queryKey: ["customers-count-bomb"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true }).eq("customer_status", "Bom hàng")).count || 0,
  });
  const { data: totalVipCount = 0, isLoading: isLoadingVip } = useQuery({
    queryKey: ["customers-count-vip"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true }).eq("customer_status", "VIP")).count || 0,
  });
  const { data: totalChuaCoTTCount = 0, isLoading: isLoadingChuaCoTT } = useQuery({
    queryKey: ["customers-count-chuacott"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true }).eq("customer_status", "Chưa có TT")).count || 0,
  });
  const { data: totalSyncedTposCount = 0, isLoading: isLoadingSyncedTpos } = useQuery({
    queryKey: ["customers-count-synced_tpos"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true }).eq("info_status", "synced_tpos")).count || 0,
  });

  const createMutation = useMutation({
    mutationFn: async (newCustomer: CustomerFormData) => {
      const { data, error } = await supabase
        .from("customers")
        .insert([{ ...newCustomer, idkh: newCustomer.idkh || crypto.randomUUID() }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-normal"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-chuacott"] });
      queryClient.invalidateQueries({ queryKey: ["all-customers-needing-fetch"] }); // Invalidate new query
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<CustomerFormData>;
    }) => {
      const { data, error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-normal"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-warning"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-bomb"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-vip"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-chuacott"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-synced_tpos"] });
      queryClient.invalidateQueries({ queryKey: ["all-customers-needing-fetch"] }); // Invalidate new query
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-normal"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-warning"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-bomb"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-vip"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-chuacott"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-synced_tpos"] });
      queryClient.invalidateQueries({ queryKey: ["all-customers-needing-fetch"] }); // Invalidate new query
      toast.success("Đã xóa khách hàng");
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .in("id", ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-normal"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-warning"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-bomb"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-vip"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-chuacott"] });
      queryClient.invalidateQueries({ queryKey: ["customers-count-synced_tpos"] });
      queryClient.invalidateQueries({ queryKey: ["all-customers-needing-fetch"] }); // Invalidate new query
      setSelectedIds(new Set());
      toast.success(`Đã xóa ${ids.length} khách hàng thành công`);
    },
    onError: (error: any) => {
      toast.error(`Lỗi: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name.trim()) {
      toast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, updates: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      customer_name: customer.customer_name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
      customer_status: customer.customer_status,
      info_status: customer.info_status || "incomplete",
      facebook_id: customer.facebook_id || "",
      idkh: customer.idkh || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Bạn có chắc muốn xóa khách hàng này?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData({
      customer_name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
      customer_status: "Bình thường",
      info_status: "incomplete",
      facebook_id: "",
      idkh: "",
    });
  };

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    setIsDeleteDialogOpen(true);
  };

  const confirmBulkDelete = async () => {
    const idsToDelete: string[] = Array.from(selectedIds);
    await bulkDeleteMutation.mutateAsync(idsToDelete);
    setIsDeleteDialogOpen(false);
  };

  const filteredCustomers = customers.filter((customer) => {
    return true;
  });

  const isAllSelected = useMemo(() => {
    return (
      filteredCustomers.length > 0 &&
      filteredCustomers.every((c) => selectedIds.has(c.id))
    );
  }, [filteredCustomers, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return (
      filteredCustomers.some((c) => selectedIds.has(c.id)) && !isAllSelected
    );
  }, [filteredCustomers, selectedIds, isAllSelected]);

  const stats = {
    total: totalCustomersCount,
    normal: totalNormalCount,
    warning: totalWarningCount,
    bomb: totalBombCount,
    vip: totalVipCount,
    chuacott: totalChuaCoTTCount,
    synced_tpos: totalSyncedTposCount, // New stat
    wholesale: 0, 
    close: 0,
    danger: 0,
    selected: selectedIds.size,
  };

  const totalPages = Math.ceil(totalCustomersCount / pageSize);

  // Memoized list of customers to fetch for batch processing
  const customersToFetchForBatch = useMemo(() => {
    // Filter customers: must have idkh, and NOT be 'synced_tpos'
    // The limit is now applied directly in the useQuery for allCustomersNeedingFetch
    return allCustomersNeedingFetch.filter(c => 
      c.idkh && c.info_status !== 'synced_tpos'
    );
  }, [allCustomersNeedingFetch]);

  // --- NEW: Batch Fetch Logic ---
  const handleBatchFetch = async () => {
    const customersToProcess = customersToFetchForBatch;

    if (customersToProcess.length === 0) {
      toast.info("Không có khách hàng nào đủ điều kiện để fetch (cần có IDKH và chưa 'Đã Sync TPOS').");
      return;
    }

    setIsBatchFetching(true);
    setBatchFetchProgress(0);
    setBatchFetchTotal(customersToProcess.length);
    setBatchFetchResults([]);
    setBatchFetchSuccessCount(0);
    setBatchFetchFailedCount(0);

    const idkhsToFetch = customersToProcess.map(c => c.idkh);
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) {
      toast.error("Bạn chưa đăng nhập.");
      setIsBatchFetching(false);
      return;
    }

    let currentProgress = 0;
    let customersToUpsertBatch: any[] = []; // Collect updates for Supabase
    const newResults: Array<{ idkh: string; status: 'success' | 'failed'; message?: string }> = [];

    // Helper function to upsert to Supabase
    const upsertToSupabase = async (batch: any[]) => {
      const { error: upsertError } = await supabase
        .from("customers")
        .upsert(batch, {
          onConflict: "id",
          ignoreDuplicates: false
        });

      if (upsertError) {
        console.error(`Supabase upsert error for batch of ${batch.length}:`, upsertError);
        batch.forEach(item => {
          newResults.push({ idkh: item.idkh, status: 'failed', message: `Lỗi cập nhật Supabase: ${upsertError.message}` });
        });
      } else {
        console.log(`✅ Successfully upserted ${batch.length} customers to Supabase`);
        batch.forEach(item => {
          newResults.push({ idkh: item.idkh, status: 'success' });
        });
      }
    };

    // Loop through TPOS batches
    for (let i = 0; i < idkhsToFetch.length; i += TPOS_FETCH_BATCH_SIZE) {
      const batchIdkhs = idkhsToFetch.slice(i, i + TPOS_FETCH_BATCH_SIZE);
      
      try {
        const response = await fetch(
          `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-tpos-customer-details-batch`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idkhs: batchIdkhs }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch TPOS data for batch");
        }

        const batchResults = await response.json(); // Array of { idkh, data?, error? }

        // Process each result from TPOS
        for (const result of batchResults) {
          currentProgress++;
          setBatchFetchProgress(currentProgress);

          if (result.data) {
            const customer = customersToProcess.find(c => c.idkh === result.idkh);
            if (customer) {
              const updates: Partial<Customer> = {
                id: customer.id,
                idkh: customer.idkh,
                customer_name: result.data.Name || customer.customer_name,
                phone: result.data.Phones?.[0]?.Number || customer.phone,
                email: result.data.Email || customer.email,
                address: result.data.Addresses?.[0]?.Address || customer.address,
                notes: result.data.Note || customer.notes,
                customer_status: mapStatusText(result.data.StatusText),
                info_status: 'synced_tpos' as const,
              };
              customersToUpsertBatch.push(updates);
            } else {
              newResults.push({ idkh: result.idkh, status: 'failed', message: 'Không tìm thấy khách hàng trong Supabase' });
            }
          } else {
            newResults.push({ idkh: result.idkh, status: 'failed', message: result.error || 'Lỗi không xác định từ TPOS' });
          }
        }

        // Upsert every 1000 items
        if (customersToUpsertBatch.length >= SUPABASE_UPSERT_BATCH_SIZE) {
          await upsertToSupabase(customersToUpsertBatch);
          customersToUpsertBatch = [];
        }

      } catch (error: any) {
        console.error("Batch fetch error:", error);
        batchIdkhs.forEach(idkh => {
          currentProgress++;
          setBatchFetchProgress(currentProgress);
          newResults.push({ idkh, status: 'failed', message: error.message || 'Lỗi khi gọi Edge Function' });
        });
      }
      
      // Delay between TPOS API calls
      if (i + TPOS_FETCH_BATCH_SIZE < idkhsToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, TPOS_FETCH_DELAY_MS));
      }
    }

    // Upsert remaining items (< 1000)
    if (customersToUpsertBatch.length > 0) {
      await upsertToSupabase(customersToUpsertBatch);
    }

    // Final calculation of success/failed counts
    const finalSuccessCount = newResults.filter(r => r.status === 'success').length;
    const finalFailedCount = newResults.filter(r => r.status === 'failed').length;

    setBatchFetchResults([...newResults]);
    setBatchFetchSuccessCount(finalSuccessCount);
    setBatchFetchFailedCount(finalFailedCount);

    setIsBatchFetching(false);
    queryClient.invalidateQueries({ queryKey: ["customers"] });
    queryClient.invalidateQueries({ queryKey: ["customers-count-synced_tpos"] });
    queryClient.invalidateQueries({ queryKey: ["all-customers-needing-fetch"] });
    toast.success(`Hoàn tất fetch: ${finalSuccessCount} thành công, ${finalFailedCount} thất bại.`);
  };

  const handleCloseBatchFetchDialog = (open: boolean) => {
    setIsBatchFetchDialogOpen(open); // Update the state based on Dialog's internal state
    if (!open) { // If dialog is closing
      setBatchFetchResults([]);
      setBatchFetchProgress(0);
      setBatchFetchTotal(0);
      setBatchFetchSuccessCount(0);
      setBatchFetchFailedCount(0);
      setSelectedIds(new Set()); // Clear selection after batch fetch
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="w-8 h-8" />
            Kho Khách Hàng
          </h1>
          <p className="text-muted-foreground mt-1">
            Quản lý thông tin khách hàng
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Xóa {selectedIds.size} khách hàng
            </Button>
          )}
          
          {/* Nút "Cập nhật dữ liệu KH" và Select số lượng */}
          <div className="flex items-center gap-2">
            <Select value={maxCustomersToBatch} onValueChange={setMaxCustomersToBatch} disabled={isBatchFetching}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Số lượng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100 khách hàng</SelectItem>
                <SelectItem value="500">500 khách hàng</SelectItem>
                <SelectItem value="1000">1000 khách hàng</SelectItem>
                <SelectItem value="10000">10000 khách hàng</SelectItem> {/* New option */}
              </SelectContent>
            </Select>
            <Dialog open={isBatchFetchDialogOpen} onOpenChange={handleCloseBatchFetchDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isBatchFetching || customersToFetchForBatch.length === 0}
                  className="flex items-center gap-2"
                >
                  <CloudDownload className="w-4 h-4" />
                  Cập nhật dữ liệu KH ({customersToFetchForBatch.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CloudDownload className="h-5 w-5" />
                    Fetch thông tin khách hàng từ TPOS
                  </DialogTitle>
                  <DialogDescription>
                    Đang lấy và cập nhật thông tin cho {batchFetchTotal} khách hàng đã chọn.
                    <br/>
                    <span className="text-orange-500 font-medium">
                      ⚠️ Lưu ý: Việc cập nhật số lượng lớn khách hàng có thể mất nhiều thời gian (ví dụ: 10.000 khách hàng có thể mất khoảng 40-50 phút). Vui lòng không đóng cửa sổ này.
                    </span>
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {isBatchFetching ? (
                    <div className="text-center space-y-2">
                      <Progress value={(batchFetchProgress / batchFetchTotal) * 100} className="w-full" />
                      <p className="text-sm text-muted-foreground">
                        Đang xử lý {batchFetchProgress} / {batchFetchTotal} khách hàng...
                      </p>
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mt-4" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Tổng số khách hàng:</span>
                        <Badge variant="secondary">{batchFetchTotal}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Thành công:</span>
                        <Badge className="bg-green-500 text-white">{batchFetchSuccessCount}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Thất bại:</span>
                        <Badge className="bg-red-500 text-white">{batchFetchFailedCount}</Badge>
                      </div>

                      {batchFetchResults.length > 0 && (
                        <div className="mt-4 border rounded-lg">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>IDKH</TableHead>
                                <TableHead>Trạng thái</TableHead>
                                <TableHead>Thông báo</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batchFetchResults.map((result, index) => (
                                <TableRow key={index}>
                                  <TableCell className="font-mono text-xs">{result.idkh}</TableCell>
                                  <TableCell>
                                    {result.status === 'success' ? (
                                      <CheckCircle className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {result.message || (result.status === 'success' ? 'Cập nhật thành công' : 'Lỗi không xác định')}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button onClick={() => handleCloseBatchFetchDialog(false)} disabled={isBatchFetching}>
                    Đóng
                  </Button>
                  {isBatchFetching ? null : (
                    <Button onClick={() => handleBatchFetch()} disabled={customersToFetchForBatch.length === 0}>
                      Bắt đầu Fetch
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <Button onClick={() => setIsImportCustomersDialogOpen(true)} variant="outline">
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleCloseDialog()}>
                <UserPlus className="w-4 h-4 mr-2" />
                Thêm Khách Hàng
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer
                    ? "Chỉnh Sửa Khách Hàng"
                    : "Thêm Khách Hàng Mới"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer_name">Tên khách hàng *</Label>
                    <Input
                      id="customer_name"
                      value={formData.customer_name}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customer_name: e.target.value,
                        })
                      }
                      placeholder="Nhập tên khách hàng"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Số điện thoại</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      placeholder="Nhập email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer_status">Trạng thái</Label>
                    <Select
                      value={formData.customer_status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, customer_status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bình thường">Bình thường</SelectItem>
                        <SelectItem value="Bom hàng">Bom hàng</SelectItem>
                        <SelectItem value="Cảnh báo">Cảnh báo</SelectItem>
                        <SelectItem value="Khách sỉ">Khách sỉ</SelectItem>
                        <SelectItem value="Nguy hiểm">Nguy hiểm</SelectItem>
                        <SelectItem value="Thân thiết">Thân thiết</SelectItem>
                        <SelectItem value="VIP">VIP</SelectItem>
                        <SelectItem value="Chưa có TT">Chưa có TT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Địa chỉ</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Nhập địa chỉ"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="facebook_id">Facebook ID</Label>
                  <Input
                    id="facebook_id"
                    value={formData.facebook_id}
                    onChange={(e) =>
                      setFormData({ ...formData, facebook_id: e.target.value })
                    }
                    placeholder="Nhập Facebook ID"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idkh">IDKH (TPOS ID)</Label>
                  <Input
                    id="idkh"
                    value={formData.idkh}
                    onChange={(e) =>
                      setFormData({ ...formData, idkh: e.target.value })
                    }
                    placeholder="Nhập IDKH từ TPOS (nếu có)"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Ghi chú</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    placeholder="Nhập ghi chú"
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCloseDialog}
                  >
                    Hủy
                  </Button>
                  <Button type="submit">
                    {editingCustomer ? "Cập Nhật" : "Thêm"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Tổng KH</p>
              <p className="text-2xl font-bold">{totalCustomersCount}</p>
            </div>
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
        </Card>
        {selectedIds.size > 0 && (
          <Card className="p-4 border-primary">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Đã chọn</p>
                <p className="text-2xl font-bold text-primary">{stats.selected}</p>
              </div>
              <Checkbox checked={true} className="pointer-events-none h-6 w-6" />
            </div>
          </Card>
        )}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bình thường</p>
              <p className="text-2xl font-bold">
                {isLoadingNormal ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.normal}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cảnh báo</p>
              <p className="text-2xl font-bold">
                {isLoadingWarning ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.warning}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Bom hàng</p>
              <p className="text-2xl font-bold">
                {isLoadingBomb ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.bomb}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-red-600"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Chưa có TT</p>
              <p className="text-2xl font-bold">
                {isLoadingChuaCoTT ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.chuacott}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Đã Sync TPOS</p>
              <p className="text-2xl font-bold">
                {isLoadingSyncedTpos ? <Loader2 className="h-6 w-6 animate-spin" /> : stats.synced_tpos}
              </p>
            </div>
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          </div>
        </Card>
      </div>

      {selectedIds.size > 0 && (
        <Card className="p-4 bg-primary/10 border-primary/20">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Đã chọn {selectedIds.size} khách hàng
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
            >
              Bỏ chọn tất cả
            </Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Tìm kiếm theo tên, SĐT, email..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select 
            value={statusFilter} 
            onValueChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Lọc theo trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="Bình thường">Bình thường</SelectItem>
              <SelectItem value="Bom hàng">Bom hàng</SelectItem>
              <SelectItem value="Cảnh báo">Cảnh báo</SelectItem>
              <SelectItem value="Khách sỉ">Khách sỉ</SelectItem>
              <SelectItem value="Nguy hiểm">Nguy hiểm</SelectItem>
              <SelectItem value="Thân thiết">Thân thiết</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="Chưa có TT">Chưa có TT</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className={isSomeSelected ? "opacity-50" : ""}
                  aria-label="Chọn tất cả"
                />
              </TableHead>
              <TableHead>Tên khách hàng</TableHead>
              <TableHead>Liên hệ</TableHead>
              <TableHead>Địa chỉ</TableHead>
              <TableHead>Trạng thái KH</TableHead>
              <TableHead>Trạng thái TT</TableHead>
              <TableHead className="text-right">Đơn hàng</TableHead>
              <TableHead className="text-right">Tổng chi</TableHead>
              <TableHead className="text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="mt-2 text-muted-foreground">Đang tải dữ liệu...</p>
                </TableCell>
              </TableRow>
            ) : filteredCustomers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center text-muted-foreground py-8"
                >
                  Không có khách hàng nào
                </TableCell>
              </TableRow>
            ) : (
              filteredCustomers.map((customer) => (
                <TableRow 
                  key={customer.id}
                  className={cn(
                    "transition-colors",
                    selectedIds.has(customer.id) && "bg-primary/5"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(customer.id)}
                      onCheckedChange={() => handleSelectOne(customer.id)}
                      aria-label={`Chọn ${customer.customer_name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {customer.customer_name}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      {customer.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {customer.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.address && (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="w-3 h-3" />
                        <span className="line-clamp-2">{customer.address}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                        statusColors[mapStatusText(customer.customer_status)],
                      )}
                    >
                      {statusLabels[mapStatusText(customer.customer_status)]}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "inline-flex px-2 py-1 rounded-full text-xs font-medium",
                        infoStatusColors[customer.info_status || "incomplete"],
                      )}
                    >
                      {infoStatusLabels[customer.info_status || "incomplete"]}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {customer.total_orders}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatVND(customer.total_spent)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      {customer.idkh && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCustomerToFetch({ customerId: customer.id, idkh: customer.idkh! });
                            setIsFetchCustomerInfoDialogOpen(true);
                          }}
                          title="Lấy thông tin từ TPOS"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(customer)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(customer.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {totalCustomersCount > 0 && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hiển thị</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500, 1000].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              trên {totalCustomersCount} khách hàng
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4" />
              Trang trước
            </Button>
            <span className="text-sm font-medium">
              Trang {currentPage} trên {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages || isLoading}
            >
              Trang sau
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Xác nhận xóa khách hàng
            </AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa <strong>{selectedIds.size}</strong> khách
              hàng đã chọn?
              <br />
              <br />
              <span className="text-destructive font-medium">
                ⚠️ Hành động này không thể hoàn tác!
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              className="bg-destructive hover:bg-destructive/90"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Đang xóa..." : "Xóa khách hàng"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportCustomersDialog
        open={isImportCustomersDialogOpen}
        onOpenChange={setIsImportCustomersDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
      />

      {customerToFetch && (
        <FetchCustomerInfoDialog
          open={isFetchCustomerInfoDialogOpen}
          onOpenChange={setIsFetchCustomerInfoDialogOpen}
          customerId={customerToFetch.customerId}
          idkh={customerToFetch.idkh}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["customers"] })}
        />
      )}
    </div>
  );
}
