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
    },
    // ========== Facebook & LiveCampaign APIs ==========
    {
      id: "facebook-comments",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/api/facebook-graph/comment",
      title: "Facebook Comments - Lấy comments từ Facebook",
      description: "Fetch comments của một Facebook post thông qua TPOS proxy",
      file: "supabase/functions/facebook-comments/index.ts",
      lines: "86-95",
      purpose: "Lấy danh sách comments từ Facebook Graph API để hiển thị và xử lý đơn hàng trong hệ thống",
      headers: {
        "Authorization": "Bearer {facebook_bearer_token}",
        "accept": "application/json",
        "tposappversion": "5.9.10.1"
      },
      queryParams: {
        "pageid": "{page_id}",
        "facebook_type": "Page",
        "postId": "{post_id}",
        "limit": "500",
        "order": "reverse_chronological"
      },
      requestPayload: null,
      responsePayload: {
        "data": [
          {
            "id": "123456789_987654321",
            "message": "Đặt [N152] size M",
            "from": {
              "id": "987654321",
              "name": "Nguyễn Văn A"
            },
            "created_time": "2025-10-23T08:30:00+0000"
          }
        ],
        "paging": {
          "cursors": { "before": "...", "after": "..." }
        }
      }
    },
    {
      id: "facebook-livevideo",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/api/facebook-graph/livevideo",
      title: "Facebook LiveVideo - Lấy danh sách live videos",
      description: "Fetch danh sách live videos từ Facebook page",
      file: "supabase/functions/facebook-livevideo/index.ts",
      lines: "75-85",
      purpose: "Lấy danh sách live videos từ Facebook page để user chọn và tạo live session",
      headers: {
        "Authorization": "Bearer {facebook_bearer_token}",
        "accept": "application/json",
        "tposappversion": "5.9.10.1"
      },
      queryParams: {
        "pageid": "{page_id}",
        "limit": "25",
        "facebook_Type": "Page"
      },
      requestPayload: null,
      responsePayload: {
        "data": [
          {
            "id": "123456789",
            "title": "Live bán hàng ngày 23/10",
            "description": "Flash sale cuối tuần",
            "created_time": "2025-10-23T14:00:00+0000",
            "status": "LIVE"
          }
        ]
      }
    },
    {
      id: "save-facebook-posts",
      method: "POST",
      endpoint: "https://tomato.tpos.vn/rest/v1.0/facebookpost/save_posts",
      title: "Save Facebook Posts - Tạo LiveCampaign",
      description: "Tạo LiveCampaign mới cho Facebook post trên TPOS",
      file: "supabase/functions/create-tpos-order-from-comment/index.ts",
      lines: "213-227",
      purpose: "Tạo LiveCampaign trên TPOS để tracking đơn hàng từ Facebook post",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      requestPayload: {
        "PostIds": ["123456789_987654321"],
        "TeamId": 1
      },
      responsePayload: {
        "success": true,
        "message": "LiveCampaign created successfully"
      }
    },
    {
      id: "get-saved-posts",
      method: "POST",
      endpoint: "https://tomato.tpos.vn/rest/v1.0/facebookpost/get_saved_by_ids",
      title: "Get Saved Posts - Lấy LiveCampaignId",
      description: "Lấy LiveCampaignId đã tồn tại cho Facebook post",
      file: "supabase/functions/create-tpos-order-from-comment/index.ts",
      lines: "254-268",
      purpose: "Kiểm tra xem post đã có LiveCampaign chưa, nếu có thì lấy ID để tạo đơn",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      requestPayload: {
        "PostIds": ["123456789_987654321"],
        "TeamId": 1
      },
      responsePayload: [
        {
          "Id": 12345,
          "PostId": "123456789_987654321",
          "TeamId": 1
        }
      ]
    },
    {
      id: "orders-by-postid",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetOrdersByPostId",
      title: "GetOrdersByPostId - Lấy orders từ Facebook post",
      description: "Fetch tất cả orders liên quan đến một Facebook post",
      file: "supabase/functions/fetch-facebook-orders/index.ts",
      lines: "46-58",
      purpose: "Lấy danh sách đơn hàng đã tạo từ Facebook post để đồng bộ về hệ thống",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "PostId": "{facebook_post_id}",
        "$top": "500",
        "$orderby": "DateCreated desc",
        "$count": "true"
      },
      requestPayload: null,
      responsePayload: {
        "@odata.count": 15,
        "value": [
          {
            "Id": 12345,
            "Name": "SO0001",
            "DateCreated": "2025-10-23T10:30:00Z",
            "TotalAmount": 400000,
            "FacebookPostId": "123456789_987654321",
            "FacebookCommentId": "987654321_111111111"
          }
        ]
      }
    },
    // ========== Partner (Customer) APIs ==========
    {
      id: "partner-search",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/Partner/ODataService.GetViewV2",
      title: "Partner Search - Tìm kiếm khách hàng",
      description: "Tìm kiếm khách hàng theo điều kiện filter",
      file: "supabase/functions/check-tpos-credentials/index.ts",
      lines: "75-85",
      purpose: "Tìm kiếm khách hàng trong TPOS để validate credentials hoặc tìm customer info",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "$top": "10",
        "$filter": "contains(Phone, '0901234567')",
        "$orderby": "DateCreated desc"
      },
      requestPayload: null,
      responsePayload: {
        "value": [
          {
            "Id": 456,
            "Name": "Nguyễn Văn A",
            "Phone": "0901234567",
            "Email": "nguyenvana@example.com",
            "Active": true
          }
        ]
      }
    },
    {
      id: "partner-detail",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/Partner({idkh})",
      title: "Partner Detail - Lấy chi tiết khách hàng",
      description: "Lấy thông tin đầy đủ của khách hàng bao gồm địa chỉ, số điện thoại, categories",
      file: "supabase/functions/fetch-tpos-customer-detail/index.ts",
      lines: "77-90",
      purpose: "Fetch thông tin chi tiết khách hàng để điền vào form đơn hàng hoặc import vào hệ thống",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "$expand": "PurchaseCurrency,Categories,AccountPayable,AccountReceivable,StockCustomer,StockSupplier,Title,PropertyProductPricelist,PropertySupplierPaymentTerm,PropertyPaymentTerm,Addresses,Phones"
      },
      requestPayload: null,
      responsePayload: {
        "Id": 456,
        "Name": "Nguyễn Văn A",
        "Phone": "0901234567",
        "Email": "nguyenvana@example.com",
        "Active": true,
        "Addresses": [
          {
            "Id": 1,
            "Street": "123 Nguyễn Huệ",
            "City": "TP.HCM",
            "Type": "delivery"
          }
        ],
        "Phones": [
          { "Id": 1, "Phone": "0901234567" }
        ]
      }
    },
    // ========== Product & Variant APIs ==========
    {
      id: "product-search",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/Product/ODataService.GetViewV2",
      title: "Product Search - Tìm kiếm variant/product",
      description: "Tìm kiếm variant hoặc product theo DefaultCode (khác với ProductTemplate)",
      file: "supabase/functions/create-tpos-order-from-comment/index.ts",
      lines: "839-855",
      purpose: "Tìm kiếm variant cụ thể để lấy ProductId khi tạo đơn hàng",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "Active": "true",
        "DefaultCode": "{variant_code}",
        "$top": "1",
        "$orderby": "DateCreated desc"
      },
      requestPayload: null,
      responsePayload: {
        "value": [
          {
            "Id": 234567,
            "Name": "Áo thun nam basic - Đen - M",
            "DefaultCode": "ATN001-DEN-M",
            "ListPrice": 200000,
            "Active": true
          }
        ]
      }
    },
    {
      id: "product-detail",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/Product({productId})",
      title: "Product Detail - Lấy chi tiết variant",
      description: "Lấy thông tin đầy đủ của variant/product bao gồm attributes",
      file: "src/components/settings/TPOSVariantLookup.tsx",
      lines: "87-95",
      purpose: "Lấy chi tiết variant để hiển thị thông tin đầy đủ trong tool lookup",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "$expand": "UOM,Categ,UOMPO,POSCateg,AttributeValues"
      },
      requestPayload: null,
      responsePayload: {
        "Id": 234567,
        "Name": "Áo thun nam basic - Đen - M",
        "DefaultCode": "ATN001-DEN-M",
        "ListPrice": 200000,
        "AttributeValues": [
          { "Id": 123, "Name": "Đen" },
          { "Id": 456, "Name": "M" }
        ]
      }
    },
    {
      id: "product-template-detail",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/ProductTemplate({templateId})",
      title: "ProductTemplate Detail - Lấy chi tiết ProductTemplate",
      description: "Lấy thông tin đầy đủ của ProductTemplate bao gồm tất cả variants",
      file: "src/components/settings/TPOSManagerNew.tsx",
      lines: "345-360",
      purpose: "Lấy chi tiết ProductTemplate để sync variants về hệ thống",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "$expand": "UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)"
      },
      requestPayload: null,
      responsePayload: {
        "Id": 107831,
        "Name": "Áo thun nam basic",
        "DefaultCode": "ATN001",
        "ProductVariants": [
          {
            "Id": 234567,
            "DefaultCode": "ATN001-DEN-M",
            "Name": "Áo thun nam basic - Đen - M",
            "ListPrice": 200000
          }
        ]
      }
    },
    {
      id: "product-template-search",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2",
      title: "ProductTemplate Search - Tìm kiếm ProductTemplate",
      description: "Tìm kiếm ProductTemplate theo DefaultCode để lấy template info",
      file: "src/components/purchase-orders/BulkTPOSUploadDialog.tsx",
      lines: "575-590",
      purpose: "Tìm ProductTemplate khi upload bulk để check xem sản phẩm đã tồn tại chưa",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "Active": "true",
        "DefaultCode": "{product_code}",
        "$top": "1"
      },
      requestPayload: null,
      responsePayload: {
        "value": [
          {
            "Id": 107831,
            "Name": "Áo thun nam basic",
            "DefaultCode": "ATN001",
            "Active": true
          }
        ]
      }
    },
    // ========== CRM & Order Creation ==========
    {
      id: "crm-teams",
      method: "GET",
      endpoint: "https://tomato.tpos.vn/odata/CRMTeam/ODataService.GetAllFacebook",
      title: "CRM Teams - Lấy danh sách CRM Teams",
      description: "Lấy tất cả CRM Teams có kết nối Facebook",
      file: "supabase/functions/fetch-crm-teams/index.ts",
      lines: "59-68",
      purpose: "Lấy danh sách CRM Teams để user chọn khi tạo LiveCampaign hoặc đơn hàng",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "$expand": "Childs"
      },
      requestPayload: null,
      responsePayload: [
        {
          "Id": 1,
          "Name": "Sale Team 1",
          "FacebookPageId": "123456789",
          "Childs": []
        }
      ]
    },
    {
      id: "order-create",
      method: "POST",
      endpoint: "https://tomato.tpos.vn/odata/SaleOnline_Order",
      title: "Create Order - Tạo đơn hàng từ Facebook",
      description: "Tạo đơn hàng mới từ Facebook comment với đầy đủ thông tin",
      file: "supabase/functions/create-tpos-order-from-comment/index.ts",
      lines: "425-500",
      purpose: "Tạo đơn hàng trên TPOS từ Facebook comment với LiveCampaignId và Facebook fields",
      headers: {
        "Authorization": "Bearer {bearer_token}",
        "Content-Type": "application/json"
      },
      queryParams: {
        "IsIncrease": "True",
        "$expand": "Details,User,Partner($expand=Addresses)"
      },
      requestPayload: {
        "CRMTeamId": 1,
        "LiveCampaignId": 12345,
        "FacebookPageId": "123456789",
        "FacebookPostId": "123456789_987654321",
        "FacebookCommentId": "987654321_111111111",
        "FacebookUserId": "987654321",
        "FacebookUserName": "Nguyễn Văn A",
        "SessionIndex": "LIVE001",
        "PartnerId": 456,
        "Details": [
          {
            "ProductId": 234567,
            "ProductName": "Áo thun nam basic - Đen - M",
            "Quantity": 1,
            "Price": 200000,
            "UOMId": 1
          }
        ]
      },
      responsePayload: {
        "Id": 12345,
        "Name": "SO0001",
        "DateCreated": "2025-10-23T10:30:00Z",
        "State": "draft",
        "Partner": {
          "Id": 456,
          "Name": "Nguyễn Văn A"
        },
        "Details": [
          {
            "Id": 67890,
            "ProductId": 234567,
            "Quantity": 1
          }
        ]
      }
    },
    // ========== Authentication ==========
    {
      id: "token-refresh",
      method: "POST",
      endpoint: "https://tomato.tpos.vn/token",
      title: "Token Refresh - Làm mới TPOS access token",
      description: "Làm mới TPOS bearer token khi token cũ hết hạn",
      file: "supabase/functions/refresh-tpos-token/index.ts",
      lines: "45-58",
      purpose: "Refresh TPOS token để duy trì kết nối với TPOS API",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      requestPayload: {
        "grant_type": "password",
        "username": "{tpos_username}",
        "password": "{tpos_password}"
      },
      responsePayload: {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer",
        "expires_in": 86400
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
            Tài liệu đầy đủ 20 API endpoints của TPOS đang được sử dụng trong hệ thống, bao gồm Facebook, Products, Orders, Partners, và Authentication
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
