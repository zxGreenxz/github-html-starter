/**
 * Update TPOS product with variants using new variant generator
 */

import { generateVariants, type TPOSAttributeLine, type ProductData, type GeneratedVariant } from "./variant-generator";

export async function updateTPOSProductWithVariants(
  tposProductId: number,
  productData: ProductData,
  attributeLines: TPOSAttributeLine[],
  variants: GeneratedVariant[],
  bearerToken: string,
  onProgress?: (message: string) => void
): Promise<void> {
  const headers = {
    'Authorization': `Bearer ${bearerToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Referer': 'https://tomato.tpos.vn/',
    'Origin': 'https://tomato.tpos.vn',
    'x-request-id': crypto.randomUUID()
  };

  // Fetch existing product
  onProgress?.("🔍 Lấy thông tin sản phẩm hiện tại...");
  const getUrl = `https://tomato.tpos.vn/odata/ProductTemplate(${tposProductId})?$expand=UOM,UOMCateg,Categ,UOMPO,POSCateg,Taxes,SupplierTaxes,Product_Teams,Images,UOMView,Distributor,Importer,Producer,OriginCountry,ProductVariants($expand=UOM,Categ,UOMPO,POSCateg,AttributeValues)`;
  
  const getResponse = await fetch(getUrl, { headers });
  if (!getResponse.ok) {
    throw new Error(`Failed to get product: ${getResponse.statusText}`);
  }

  const existingProduct = await getResponse.json();

  // Build AttributeLines payload
  const tposAttributeLines = attributeLines.map(line => ({
    Id: 0,
    ProductTmplId: tposProductId,
    AttributeId: line.Attribute.Id,
    Attribute: {
      Id: line.Attribute.Id,
      Name: line.Attribute.Name,
      Code: line.Attribute.Id === 1 ? "SZCh" : line.Attribute.Id === 3 ? "Mau" : "SZNu",
      Sequence: null,
      CreateVariant: true
    },
    Values: line.Values.map(v => ({
      Id: v.Id,
      Name: v.Name,
      Code: null,
      Sequence: null,
      AttributeId: line.Attribute.Id,
      AttributeName: line.Attribute.Name,
      PriceExtra: null,
      NameGet: `${line.Attribute.Name}: ${v.Name}`,
      DateCreated: null
    }))
  }));

  // Build ProductVariants payload
  const tposVariants = variants.map(v => ({
    Id: 0,
    EAN13: null,
    DefaultCode: v.DefaultCode,
    NameTemplate: productData.Name,
    NameNoSign: null,
    ProductTmplId: tposProductId,
    UOMId: existingProduct.UOMId || 1,
    UOMName: null,
    UOMPOId: existingProduct.UOMPOId || 1,
    QtyAvailable: 0,
    VirtualAvailable: 0,
    OutgoingQty: null,
    IncomingQty: null,
    NameGet: `[${v.DefaultCode}] ${v.Name}`,
    POSCategId: null,
    Price: null,
    Barcode: v.DefaultCode,
    Image: null,
    ImageUrl: null,
    Thumbnails: [],
    PriceVariant: v.PriceVariant,
    SaleOK: true,
    PurchaseOK: true,
    DisplayAttributeValues: v.AttributeValues.map(av => `${av.AttributeName}: ${av.Name}`).join(', '),
    LstPrice: 0,
    Active: true,
    ListPrice: v.PriceVariant,
    PurchasePrice: null,
    DiscountSale: null,
    DiscountPurchase: null,
    StandardPrice: 0,
    Weight: 0,
    Volume: null,
    OldPrice: null,
    IsDiscount: false,
    ProductTmplEnableAll: false,
    Version: 0,
    Description: null,
    LastUpdated: null,
    Type: "product",
    CategId: existingProduct.CategId || 2,
    CostMethod: null,
    InvoicePolicy: "order",
    Variant_TeamId: 0,
    Name: v.Name,
    PropertyCostMethod: null,
    PropertyValuation: null,
    PurchaseMethod: "receive",
    SaleDelay: 0,
    Tracking: null,
    Valuation: null,
    AvailableInPOS: true,
    CompanyId: null,
    IsCombo: null,
    NameTemplateNoSign: productData.Name,
    TaxesIds: [],
    StockValue: null,
    SaleValue: null,
    PosSalesCount: null,
    Factor: null,
    CategName: null,
    AmountTotal: null,
    NameCombos: [],
    RewardName: null,
    Product_UOMId: null,
    Tags: null,
    DateCreated: null,
    InitInventory: null,
    OrderTag: "",
    StringExtraProperties: JSON.stringify({
      OrderTag: null,
      Thumbnails: []
    }),
    CreatedById: existingProduct.CreatedById || null,
    TaxAmount: null,
    Error: null,
    UOM: existingProduct.UOM,
    Categ: existingProduct.Categ,
    UOMPO: existingProduct.UOMPO,
    POSCateg: null,
    AttributeValues: v.AttributeValues.map(av => ({
      Id: av.Id,
      Name: av.Name,
      Code: av.Code || av.Name,
      Sequence: null,
      AttributeId: av.AttributeId,
      AttributeName: av.AttributeName,
      PriceExtra: null,
      NameGet: `${av.AttributeName}: ${av.Name}`,
      DateCreated: null
    }))
  }));

  // Build update payload
  const updatePayload = {
    ...existingProduct,
    AttributeLines: tposAttributeLines,
    ProductVariants: tposVariants
  };

  // Update product
  onProgress?.(`🚀 Cập nhật ${variants.length} variants lên TPOS...`);
  const updateUrl = `https://tomato.tpos.vn/odata/ProductTemplate/ODataService.UpdateV2`;
  const updateResponse = await fetch(updateUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(updatePayload)
  });

  if (!updateResponse.ok && updateResponse.status !== 204) {
    const errorText = await updateResponse.text();
    throw new Error(`TPOS Update Error: ${updateResponse.status} - ${errorText.substring(0, 200)}`);
  }

  onProgress?.("✅ Cập nhật variants thành công");
}
