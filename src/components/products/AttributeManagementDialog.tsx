import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { useProductAttributes } from "@/hooks/use-product-attributes";
import { CreateAttributeDialog } from "./CreateAttributeDialog";
import { CreateAttributeValueDialog } from "./CreateAttributeValueDialog";
import { AttributeValuesList } from "./AttributeValuesList";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface AttributeManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttributeManagementDialog({
  open,
  onOpenChange,
}: AttributeManagementDialogProps) {
  const {
    attributes,
    attributeValues,
    isLoading,
    createAttribute,
    deleteAttribute,
    createAttributeValue,
    deleteAttributeValue,
  } = useProductAttributes();

  const [isCreateAttrDialogOpen, setIsCreateAttrDialogOpen] = useState(false);
  const [isCreateValueDialogOpen, setIsCreateValueDialogOpen] = useState(false);
  const [selectedAttributeId, setSelectedAttributeId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "attribute" | "value"; id: string; name: string } | null>(null);

  const selectedAttribute = attributes.find(a => a.id === selectedAttributeId);
  const valuesForSelectedAttribute = attributeValues.filter(
    v => v.attribute_id === selectedAttributeId
  );

  const handleCreateAttribute = (name: string) => {
    createAttribute.mutate(name);
  };

  const handleCreateValue = (value: string) => {
    if (selectedAttributeId) {
      createAttributeValue.mutate({ attributeId: selectedAttributeId, value });
    }
  };

  const handleDeleteAttribute = (id: string) => {
    deleteAttribute.mutate(id);
    setDeleteConfirm(null);
  };

  const handleDeleteValue = (id: string) => {
    deleteAttributeValue.mutate(id);
    setDeleteConfirm(null);
  };

  const openCreateValueDialog = (attributeId: string) => {
    setSelectedAttributeId(attributeId);
    setIsCreateValueDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Quản lý thuộc tính sản phẩm
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Quản lý các thuộc tính và giá trị để sử dụng cho sản phẩm
              </p>
              <Button
                onClick={() => setIsCreateAttrDialogOpen(true)}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Thêm thuộc tính
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Đang tải...
              </div>
            ) : attributes.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">
                  Chưa có thuộc tính nào. Nhấn "Thêm thuộc tính" để bắt đầu.
                </p>
              </Card>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {attributes.map((attribute) => {
                  const values = attributeValues.filter(
                    v => v.attribute_id === attribute.id
                  );
                  
                  return (
                    <AccordionItem
                      key={attribute.id}
                      value={attribute.id}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{attribute.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({values.length} giá trị)
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirm({
                                type: "attribute",
                                id: attribute.id,
                                name: attribute.name,
                              });
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pb-4">
                        <AttributeValuesList
                          values={values}
                          onDelete={(id) => {
                            const value = values.find(v => v.id === id);
                            if (value) {
                              setDeleteConfirm({
                                type: "value",
                                id,
                                name: value.value,
                              });
                            }
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => openCreateValueDialog(attribute.id)}
                        >
                          <Plus className="h-4 w-4" />
                          Thêm giá trị
                        </Button>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateAttributeDialog
        open={isCreateAttrDialogOpen}
        onOpenChange={setIsCreateAttrDialogOpen}
        onSubmit={handleCreateAttribute}
        existingNames={attributes.map(a => a.name)}
      />

      {selectedAttribute && (
        <CreateAttributeValueDialog
          open={isCreateValueDialogOpen}
          onOpenChange={setIsCreateValueDialogOpen}
          onSubmit={handleCreateValue}
          attributeName={selectedAttribute.name}
          existingValues={valuesForSelectedAttribute.map(v => v.value)}
        />
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận xóa</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "attribute" ? (
                <>
                  Bạn có chắc muốn xóa thuộc tính <strong>"{deleteConfirm.name}"</strong>?
                  <br />
                  Tất cả giá trị của thuộc tính này cũng sẽ bị xóa.
                </>
              ) : (
                <>
                  Bạn có chắc muốn xóa giá trị <strong>"{deleteConfirm?.name}"</strong>?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm?.type === "attribute") {
                  handleDeleteAttribute(deleteConfirm.id);
                } else if (deleteConfirm?.type === "value") {
                  handleDeleteValue(deleteConfirm.id);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xóa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
