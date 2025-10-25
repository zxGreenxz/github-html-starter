import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Tags, Upload } from "lucide-react";
import { useProductAttributes, type ProductAttributeValue } from "@/hooks/use-product-attributes";
import { AttributeValueTable } from "@/components/attribute-warehouse/AttributeValueTable";
import { CreateEditAttributeValueDialog } from "@/components/attribute-warehouse/CreateEditAttributeValueDialog";
import { ImportAttributesDialog } from "@/components/attribute-warehouse/ImportAttributesDialog";

export default function AttributeWarehouse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [attributeFilter, setAttributeFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingValue, setEditingValue] = useState<ProductAttributeValue | null>(null);

  const { attributes, attributeValues, isLoading } = useProductAttributes();

  // Join data
  const enrichedValues = attributeValues.map(value => {
    const attribute = attributes.find(attr => attr.id === value.attribute_id);
    return {
      ...value,
      attributeName: attribute?.name || 'N/A',
    };
  });

  // Filter by search and attribute
  const filteredValues = enrichedValues.filter(item => {
    const matchSearch = !searchQuery || 
      item.attributeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.value.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.code && item.code.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchFilter = attributeFilter === "all" || item.attribute_id === attributeFilter;
    
    return matchSearch && matchFilter;
  });

  const handleEdit = (value: ProductAttributeValue & { attributeName: string }) => {
    setEditingValue(value);
  };

  const handleCloseEditDialog = () => {
    setEditingValue(null);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Tags className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">Kho Thuộc Tính</CardTitle>
              <CardDescription>
                Quản lý thuộc tính và giá trị sản phẩm
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex-1 w-full">
              <Input
                placeholder="Tìm kiếm theo thuộc tính, giá trị hoặc mã..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={attributeFilter} onValueChange={setAttributeFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Lọc theo thuộc tính" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {attributes.map(attr => (
                  <SelectItem key={attr.id} value={attr.id}>
                    {attr.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setIsImportDialogOpen(true)} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Import JSON
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Thêm
            </Button>
          </div>

          <AttributeValueTable
            values={filteredValues}
            isLoading={isLoading}
            onEdit={handleEdit}
          />

          <div className="text-sm text-muted-foreground">
            Hiển thị {filteredValues.length} / {attributeValues.length} giá trị
          </div>
        </CardContent>
      </Card>

      <CreateEditAttributeValueDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        editingValue={null}
      />

      <CreateEditAttributeValueDialog
        open={!!editingValue}
        onOpenChange={(open) => !open && handleCloseEditDialog()}
        editingValue={editingValue}
      />

      <ImportAttributesDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
      />
    </div>
  );
}
