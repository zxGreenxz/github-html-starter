import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ProductAttribute {
  id: string;
  name: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductAttributeValue {
  id: string;
  attribute_id: string;
  value: string;
  code?: string | null;
  price_extra?: number | null;
  name_get?: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useProductAttributes() {
  const queryClient = useQueryClient();

  // Fetch all attributes
  const { data: attributes = [], isLoading: isLoadingAttributes } = useQuery({
    queryKey: ["product-attributes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_attributes")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as ProductAttribute[];
    },
  });

  // Fetch all attribute values
  const { data: attributeValues = [], isLoading: isLoadingValues } = useQuery({
    queryKey: ["product-attribute-values"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_attribute_values")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      
      if (error) throw error;
      return data as ProductAttributeValue[];
    },
  });

  // Create attribute
  const createAttribute = useMutation({
    mutationFn: async (name: string) => {
      const maxOrder = attributes.length > 0 
        ? Math.max(...attributes.map(a => a.display_order)) 
        : 0;
      
      const { data, error } = await supabase
        .from("product_attributes")
        .insert({ name, display_order: maxOrder + 1 })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-attributes"] });
      toast({ title: "Đã tạo thuộc tính mới" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi tạo thuộc tính",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete attribute
  const deleteAttribute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_attributes")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-attributes"] });
      queryClient.invalidateQueries({ queryKey: ["product-attribute-values"] });
      toast({ title: "Đã xóa thuộc tính" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi xóa thuộc tính",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create attribute value
  const createAttributeValue = useMutation({
    mutationFn: async ({ 
      attributeId, 
      value, 
      code, 
      price_extra, 
      name_get,
      tpos_id,
      tpos_attribute_id,
      sequence
    }: { 
      attributeId: string; 
      value: string;
      code?: string | null;
      price_extra?: number;
      name_get?: string;
      tpos_id?: number;
      tpos_attribute_id?: number;
      sequence?: number | null;
    }) => {
      const valuesForAttribute = attributeValues.filter(v => v.attribute_id === attributeId);
      const maxOrder = valuesForAttribute.length > 0 
        ? Math.max(...valuesForAttribute.map(v => v.display_order)) 
        : 0;
      
      const { data, error } = await supabase
        .from("product_attribute_values")
        .insert({ 
          attribute_id: attributeId, 
          value,
          code,
          price_extra,
          name_get,
          tpos_id,
          tpos_attribute_id,
          sequence,
          display_order: maxOrder + 1 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-attribute-values"] });
      toast({ title: "Đã thêm giá trị mới" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi thêm giá trị",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update attribute value
  const updateAttributeValue = useMutation({
    mutationFn: async ({ id, value, code, price_extra, name_get }: { 
      id: string; 
      value: string;
      code?: string | null;
      price_extra?: number;
      name_get?: string;
    }) => {
      const { data, error } = await supabase
        .from("product_attribute_values")
        .update({ 
          value, 
          code,
          price_extra,
          name_get,
          updated_at: new Date().toISOString() 
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-attribute-values"] });
      toast({ title: "Đã cập nhật giá trị" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi cập nhật giá trị",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete attribute value
  const deleteAttributeValue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("product_attribute_values")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-attribute-values"] });
      toast({ title: "Đã xóa giá trị" });
    },
    onError: (error: any) => {
      toast({
        title: "Lỗi xóa giá trị",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    attributes,
    attributeValues,
    isLoading: isLoadingAttributes || isLoadingValues,
    createAttribute,
    deleteAttribute,
    createAttributeValue,
    updateAttributeValue,
    deleteAttributeValue,
  };
}
