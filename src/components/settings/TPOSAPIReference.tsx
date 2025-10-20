import { useState } from "react";
import { Code, Copy, ExternalLink, Book } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

export const TPOSAPIReference = () => {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "✅ Đã sao chép",
      description: "Payload đã được copy vào clipboard",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const apis = [
    {
      id: "insertv2",
      method: "POST",
      endpoint: "https://tomato.tpos.vn/api/InsertV2",
      title: "InsertV2 API - Upload sản phẩm có variants",
      description: "Upload sản phẩm mới với nhiều biến thể lên TPOS",
      file: "src/lib/tpos-insertv2-builder.ts",
      lines: "401-443",
      purpose: "Tạo sản phẩm mới trên TPOS với đầy đủ thông tin variants, attributes, hình ảnh",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      },
      requestPayload: {
        "Id": 0,
        "Name": "Áo thun nam basic",
        "Type": "product",
        "DefaultCode": "ATN001",
        "ListPrice": 200000,
        "PurchasePrice": 120000,
        "Image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
        "ImageUrl": null,
        "AttributeLines": [
          {
            "Id": 0,
            "AttributeId": 1,
            "AttributeName": "Màu sắc",
            "ValueIds": [
              { "Id": 0, "Name": "Đen", "Code": "DEN" },
              { "Id": 0, "Name": "Trắng", "Code": "TRANG" }
            ]
          },
          {
            "Id": 0,
            "AttributeId": 2,
            "AttributeName": "Kích cỡ chữ",
            "ValueIds": [
              { "Id": 0, "Name": "M", "Code": "M" },
              { "Id": 0, "Name": "L", "Code": "L" }
            ]
          }
        ],
        "ProductVariants": [
          {
            "Id": 0,
            "DefaultCode": "ATN001-DEN-M",
            "Name": "Áo thun nam basic - Đen - M",
            "ListPrice": 200000,
            "Active": true,
            "Image": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
            "AttributeValueIds": [123, 456]
          }
        ],
        "Active": true,
        "SaleOK": true,
        "PurchaseOK": true,
        "AvailableInPOS": true,
        "Tracking": "none",
        "InvoicePolicy": "order",
        "PurchaseMethod": "receive",
        "Weight": 0.5,
        "SaleDelay": 0,
        "UOMId": 1,
        "UOMPOId": 1,
        "UOM": { "Id": 1, "Name": "Cái" },
        "UOMPO": { "Id": 1, "Name": "Cái" },
        "CategId": 1,
        "Categ": { "Id": 1, "Name": "Thời trang" },
        "CompanyId": 82718,
        "Items": [],
        "UOMLines": [],
        "ComboProducts": [],
        "ProductSupplierInfos": []
      },
      responsePayload: {
        "Id": 107831,
        "Name": "Áo thun nam basic",
        "DefaultCode": "ATN001",
        "ProductVariants": [
          {
            "Id": 234567,
            "DefaultCode": "ATN001-DEN-M",
            "Name": "Áo thun nam basic - Đen - M"
          }
        ]
      }
    },
    {
      id: "getview",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/Product/OdataService.GetViewV2",
      title: "GetViewV2 - Tìm kiếm sản phẩm",
      description: "Tìm kiếm sản phẩm theo DefaultCode",
      file: "src/lib/tpos-api.ts",
      lines: "77-109",
      purpose: "Tìm kiếm sản phẩm trên TPOS theo mã code để lấy ProductId và thông tin chi tiết",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "Active": "true",
        "DefaultCode": "{product_code}",
        "$top": "50",
        "$orderby": "DateCreated desc"
      },
      requestPayload: null,
      responsePayload: {
        "value": [
          {
            "Id": 107831,
            "Name": "Áo thun nam basic",
            "DefaultCode": "ATN001",
            "ListPrice": 200000,
            "Active": true,
            "DateCreated": "2024-01-15T10:30:00Z"
          }
        ]
      }
    },
    {
      id: "order-put",
      method: "PUT",
      endpoint: "https://tomato.tpos.vn/odata/SaleOnline_Order({orderId})",
      title: "SaleOnline_Order PUT - Cập nhật đơn hàng",
      description: "Cập nhật chi tiết đơn hàng trên TPOS",
      file: "src/lib/tpos-api.ts",
      lines: "434-443",
      purpose: "Upload chi tiết sản phẩm vào đơn hàng đã tạo trên TPOS",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      requestPayload: {
        "Details": [
          {
            "ProductId": 107831,
            "ProductName": "Áo thun nam basic - Đen - M",
            "Quantity": 2,
            "Price": 200000,
            "UOMId": 1,
            "UOMName": "Cái"
          }
        ]
      },
      responsePayload: {
        "Id": 12345,
        "Details": [
          {
            "Id": 67890,
            "ProductId": 107831,
            "Quantity": 2,
            "Price": 200000
          }
        ]
      }
    },
    {
      id: "order-get",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView",
      title: "SaleOnline_Order GET - Lấy danh sách đơn hàng",
      description: "Fetch orders theo date range và session index",
      file: "src/lib/tpos-order-uploader.ts",
      lines: "55-138",
      purpose: "Lấy danh sách đơn hàng từ TPOS theo khoảng thời gian và session index để đồng bộ về hệ thống",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "$filter": "DateCreated ge {startDate} and DateCreated le {endDate} and SessionIndex eq {sessionIndex}",
        "$expand": "Details,Partner,User,CRMTeam",
        "$top": "100"
      },
      requestPayload: null,
      responsePayload: {
        "value": [
          {
            "Id": 12345,
            "Name": "SO0001",
            "DateCreated": "2024-01-15T10:30:00Z",
            "SessionIndex": "LIVE001",
            "TotalAmount": 400000,
            "Partner": {
              "Id": 456,
              "Name": "Nguyễn Văn A",
              "Phone": "0901234567"
            },
            "Details": [
              {
                "ProductId": 107831,
                "ProductName": "Áo thun nam basic - Đen - M",
                "Quantity": 2,
                "Price": 200000
              }
            ]
          }
        ]
      }
    },
    {
      id: "order-detail",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/SaleOnline_Order({orderId})?$expand=Details,Partner,User,CRMTeam",
      title: "SaleOnline_Order Detail - Lấy chi tiết một đơn hàng",
      description: "Lấy thông tin chi tiết của một đơn hàng cụ thể",
      file: "src/lib/tpos-order-uploader.ts",
      lines: "141-150",
      purpose: "Lấy chi tiết đầy đủ của một đơn hàng bao gồm sản phẩm, khách hàng, team",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      requestPayload: null,
      responsePayload: {
        "Id": 12345,
        "Name": "SO0001",
        "DateCreated": "2024-01-15T10:30:00Z",
        "SessionIndex": "LIVE001",
        "TotalAmount": 400000,
        "State": "sale",
        "Partner": {
          "Id": 456,
          "Name": "Nguyễn Văn A",
          "Phone": "0901234567",
          "Address": "123 Nguyễn Huệ, Q1, TP.HCM"
        },
        "User": {
          "Id": 789,
          "Name": "Admin"
        },
        "CRMTeam": {
          "Id": 1,
          "Name": "Sale Team 1"
        },
        "Details": [
          {
            "Id": 67890,
            "ProductId": 107831,
            "ProductName": "Áo thun nam basic - Đen - M",
            "Quantity": 2,
            "Price": 200000,
            "Subtotal": 400000
          }
        ]
      }
    },
    {
      id: "updatev2",
      method: "POST",
      endpoint: "https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2",
      title: "ProductTemplate UpdateV2 - Cập nhật variants",
      description: "Cập nhật variants của sản phẩm đã có trên TPOS",
      file: "src/lib/tpos-variant-creator.ts",
      lines: "543-563",
      purpose: "Tự động tạo thêm variants cho sản phẩm đã tồn tại trên TPOS dựa vào chuỗi variant",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      requestPayload: {
        "Id": 107831,
        "Name": "Áo thun nam basic",
        "DefaultCode": "ATN001",
        "AttributeLines": [
          {
            "Id": 0,
            "AttributeId": 1,
            "AttributeName": "Màu sắc",
            "ValueIds": [
              { "Id": 0, "Name": "Đen", "Code": "DEN" },
              { "Id": 0, "Name": "Trắng", "Code": "TRANG" },
              { "Id": 0, "Name": "Xanh", "Code": "XANH" }
            ]
          },
          {
            "Id": 0,
            "AttributeId": 2,
            "AttributeName": "Kích cỡ chữ",
            "ValueIds": [
              { "Id": 0, "Name": "M", "Code": "M" },
              { "Id": 0, "Name": "L", "Code": "L" },
              { "Id": 0, "Name": "XL", "Code": "XL" }
            ]
          }
        ],
        "ProductVariants": [
          {
            "Id": 0,
            "DefaultCode": "ATN001-DEN-M",
            "Name": "Áo thun nam basic - Đen - M",
            "ListPrice": 200000,
            "Active": true,
            "AttributeValueIds": []
          },
          {
            "Id": 0,
            "DefaultCode": "ATN001-TRANG-M",
            "Name": "Áo thun nam basic - Trắng - M",
            "ListPrice": 200000,
            "Active": true,
            "AttributeValueIds": []
          }
        ],
        "UOMLines": [],
        "Active": true,
        "SaleOK": true,
        "PurchaseOK": true
      },
      responsePayload: {
        "Id": 107831,
        "Name": "Áo thun nam basic",
        "ProductVariants": [
          {
            "Id": 234567,
            "DefaultCode": "ATN001-DEN-M"
          },
          {
            "Id": 234568,
            "DefaultCode": "ATN001-TRANG-M"
          }
        ]
      }
    }
  ];

  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-blue-500 hover:bg-blue-600";
      case "POST":
        return "bg-green-500 hover:bg-green-600";
      case "PUT":
        return "bg-orange-500 hover:bg-orange-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="h-5 w-5" />
            TPOS API Reference Documentation
          </CardTitle>
          <CardDescription>
            Tài liệu tham khảo các API endpoint của TPOS đang được sử dụng trong hệ thống
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {apis.map((api) => (
              <AccordionItem key={api.id} value={api.id}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={`${getMethodBadgeColor(api.method)} text-white`}>
                      {api.method}
                    </Badge>
                    <span className="font-semibold text-left">{api.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-4">
                    {/* Description */}
                    <div>
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Mô tả
                      </h4>
                      <p className="text-sm text-muted-foreground">{api.purpose}</p>
                    </div>

                    {/* Endpoint */}
                    <div>
                      <h4 className="font-semibold mb-2">Endpoint</h4>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted p-2 rounded block flex-1 break-all">
                          {api.endpoint}
                        </code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(api.endpoint.split('?')[0], '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* File Location */}
                    <div>
                      <h4 className="font-semibold mb-2">File trong codebase</h4>
                      <code className="text-xs bg-muted p-2 rounded block">
                        {api.file} (lines {api.lines})
                      </code>
                    </div>

                    {/* Headers */}
                    <div>
                      <h4 className="font-semibold mb-2">Headers</h4>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                        {JSON.stringify(api.headers, null, 2)}
                      </pre>
                    </div>

                    {/* Query Params */}
                    {api.queryParams && (
                      <div>
                        <h4 className="font-semibold mb-2">Query Parameters</h4>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                          {JSON.stringify(api.queryParams, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Request Payload */}
                    {api.requestPayload && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Request Payload</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(JSON.stringify(api.requestPayload, null, 2), `${api.id}-request`)}
                          >
                            {copiedId === `${api.id}-request` ? (
                              "✓ Copied"
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy JSON
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96">
                          {JSON.stringify(api.requestPayload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Response Payload */}
                    {api.responsePayload && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">Response Payload</h4>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(JSON.stringify(api.responsePayload, null, 2), `${api.id}-response`)}
                          >
                            {copiedId === `${api.id}-response` ? (
                              "✓ Copied"
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-2" />
                                Copy JSON
                              </>
                            )}
                          </Button>
                        </div>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-96">
                          {JSON.stringify(api.responsePayload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
