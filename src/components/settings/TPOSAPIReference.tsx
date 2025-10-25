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
                    {(api as any).queryParams && (
                      <div>
                        <h4 className="font-semibold mb-2">Query Parameters</h4>
                        <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                          {JSON.stringify((api as any).queryParams, null, 2)}
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
