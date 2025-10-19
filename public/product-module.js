// ========== PRODUCT MODULE ==========

// Shared configuration - import from main app
let getHeaders;
let showMessage;

// Product Module State
const availableAttributes = {
  sizeText: {
    id: 1, name: "Size Chữ", code: "SZCh",
    values: [
      { Id: 31, Name: "XXL", Code: "xxl", Sequence: null },
      { Id: 32, Name: "XXXL", Code: "xxxl", Sequence: null },
      { Id: 5, Name: "Free Size", Code: "FS", Sequence: 0 },
      { Id: 1, Name: "S", Code: "S", Sequence: 1 },
      { Id: 2, Name: "M", Code: "M", Sequence: 2 },
      { Id: 3, Name: "L", Code: "L", Sequence: 3 },
      { Id: 4, Name: "XL", Code: "XL", Sequence: 4 },
    ],
  },
  color: {
    id: 3, name: "Màu", code: "Mau",
    values: [
      { Id: 6, Name: "Trắng", Code: "trang", Sequence: null },
      { Id: 7, Name: "Đen", Code: "den", Sequence: null },
      { Id: 8, Name: "Đỏ", Code: "do", Sequence: null },
      { Id: 9, Name: "Vàng", Code: "vang", Sequence: null },
      { Id: 10, Name: "Cam", Code: "cam", Sequence: null },
      { Id: 11, Name: "Xám", Code: "xam", Sequence: null },
      { Id: 12, Name: "Hồng", Code: "hong", Sequence: null },
      { Id: 14, Name: "Nude", Code: "nude", Sequence: null },
      { Id: 15, Name: "Nâu", Code: "nau", Sequence: null },
      { Id: 16, Name: "Rêu", Code: "reu", Sequence: null },
      { Id: 17, Name: "Xanh", Code: "xanh", Sequence: null },
      { Id: 25, Name: "Bạc", Code: "bac", Sequence: null },
      { Id: 26, Name: "Tím", Code: "tim", Sequence: null },
      { Id: 27, Name: "Xanh Min", Code: "xanhmin", Sequence: null },
      { Id: 28, Name: "Trắng Kem", Code: "trangkem", Sequence: null },
      { Id: 29, Name: "Xanh Lá", Code: "xanhla", Sequence: null },
      { Id: 38, Name: "Cổ Vịt", Code: "co vit", Sequence: null },
      { Id: 40, Name: "Xanh Đậu", Code: "xanh dau", Sequence: null },
      { Id: 42, Name: "Tím Môn", Code: "timmon", Sequence: null },
      { Id: 43, Name: "Muối Tiêu", Code: "muoitieu", Sequence: null },
      { Id: 45, Name: "Kem", Code: "kem", Sequence: null },
      { Id: 47, Name: "Hồng Đậm", Code: "hongdam", Sequence: null },
      { Id: 49, Name: "Ghi", Code: "ghi", Sequence: null },
      { Id: 50, Name: "Xanh Mạ", Code: "xanhma", Sequence: null },
      { Id: 51, Name: "Vàng Đồng", Code: "vangdong", Sequence: null },
      { Id: 52, Name: "Xanh Bơ", Code: "xanhbo", Sequence: null },
      { Id: 53, Name: "Xanh Đen", Code: "xanhden", Sequence: null },
      { Id: 54, Name: "Xanh CoBan", Code: "xanhcoban", Sequence: null },
      { Id: 55, Name: "Xám Đậm", Code: "xamdam", Sequence: null },
      { Id: 56, Name: "Xám Nhạt", Code: "xamnhat", Sequence: null },
      { Id: 57, Name: "Xanh Dương", Code: "xanhduong", Sequence: null },
      { Id: 58, Name: "Cam Sữa", Code: "camsua", Sequence: null },
      { Id: 59, Name: "Hồng Nhạt", Code: "hongnhat", Sequence: null },
      { Id: 60, Name: "Đậm", Code: "dam", Sequence: null },
      { Id: 61, Name: "Nhạt", Code: "nhat", Sequence: null },
      { Id: 62, Name: "Xám Khói", Code: "xamkhoi", Sequence: null },
      { Id: 63, Name: "Xám Chuột", Code: "xamchuot", Sequence: null },
      { Id: 64, Name: "Xám Đen", Code: "xamden", Sequence: null },
      { Id: 65, Name: "Xám Trắng", Code: "xamtrang", Sequence: null },
      { Id: 66, Name: "Xanh Đậm", Code: "xanhdam", Sequence: null },
      { Id: 67, Name: "Sọc Đen", Code: "socden", Sequence: null },
      { Id: 68, Name: "Sọc Trắng", Code: "soctrang", Sequence: null },
      { Id: 69, Name: "Sọc Xám", Code: "socxam", Sequence: null },
      { Id: 70, Name: "Jean Trắng", Code: "jeantrang", Sequence: null },
      { Id: 71, Name: "Jean Xanh", Code: "jeanxanh", Sequence: null },
      { Id: 72, Name: "Cam Đất", Code: "camdat", Sequence: null },
      { Id: 73, Name: "Nâu Đậm", Code: "naudam", Sequence: null },
      { Id: 74, Name: "Nâu Nhạt", Code: "naunhat", Sequence: null },
      { Id: 75, Name: "Đỏ Tươi", Code: "dotuoi", Sequence: null },
      { Id: 76, Name: "Đen Vàng", Code: "denvang", Sequence: null },
      { Id: 77, Name: "Cà Phê", Code: "caphe", Sequence: null },
      { Id: 78, Name: "Đen Bạc", Code: "denbac", Sequence: null },
      { Id: 79, Name: "Bò", Code: "bo", Sequence: null },
      { Id: 82, Name: "Sọc Xanh", Code: "socxanh", Sequence: null },
      { Id: 83, Name: "Xanh Rêu", Code: "xanhreu", Sequence: null },
      { Id: 84, Name: "Hồng Ruốc", Code: "hongruoc", Sequence: null },
      { Id: 85, Name: "Hồng Dâu", Code: "hongdau", Sequence: null },
      { Id: 86, Name: "Xanh Nhạt", Code: "xanhnhat", Sequence: null },
      { Id: 87, Name: "Xanh Ngọc", Code: "xanhngoc", Sequence: null },
      { Id: 88, Name: "Caro", Code: "caro", Sequence: null },
      { Id: 89, Name: "Sọc Hồng", Code: "sochong", Sequence: null },
      { Id: 90, Name: "Trong", Code: "trong", Sequence: null },
      { Id: 95, Name: "Trắng Hồng", Code: "tranghong", Sequence: null },
      { Id: 96, Name: "Trắng Sáng", Code: "trangsang", Sequence: null },
      { Id: 97, Name: "Đỏ Đô", Code: "dodo", Sequence: null },
      { Id: 98, Name: "Cam Đào", Code: "camdao", Sequence: null },
      { Id: 99, Name: "Cam Lạnh", Code: "camlanh", Sequence: null },
      { Id: 100, Name: "Hồng Đào", Code: "hongdao", Sequence: null },
      { Id: 101, Name: "Hồng Đất", Code: "hongdat", Sequence: null },
      { Id: 102, Name: "Tím Đậm", Code: "timdam", Sequence: null },
    ],
  },
  sizeNumber: {
    id: 4, name: "Size Số", code: "SZNu",
    values: [
      { Id: 80, Name: "27", Code: "27", Sequence: null },
      { Id: 81, Name: "28", Code: "28", Sequence: null },
      { Id: 18, Name: "29", Code: "29", Sequence: null },
      { Id: 19, Name: "30", Code: "30", Sequence: null },
      { Id: 20, Name: "31", Code: "31", Sequence: null },
      { Id: 21, Name: "32", Code: "32", Sequence: null },
      { Id: 46, Name: "34", Code: "34", Sequence: null },
      { Id: 33, Name: "35", Code: "35", Sequence: null },
      { Id: 34, Name: "36", Code: "36", Sequence: null },
      { Id: 35, Name: "37", Code: "37", Sequence: null },
      { Id: 36, Name: "38", Code: "38", Sequence: null },
      { Id: 37, Name: "39", Code: "39", Sequence: null },
      { Id: 44, Name: "40", Code: "40", Sequence: null },
      { Id: 91, Name: "41", Code: "41", Sequence: null },
      { Id: 92, Name: "42", Code: "42", Sequence: null },
      { Id: 93, Name: "43", Code: "43", Sequence: null },
      { Id: 94, Name: "44", Code: "44", Sequence: null },
      { Id: 22, Name: "1", Code: "1", Sequence: null },
      { Id: 23, Name: "2", Code: "2", Sequence: null },
      { Id: 24, Name: "3", Code: "3", Sequence: null },
      { Id: 48, Name: "4", Code: "4", Sequence: null },
    ],
  },
};

let currentAttributeLines = [];
let imageBase64 = null;
let imagePreviewUrl = null;

// ========== IMAGE HANDLING ==========
function handleImageFile(file) {
  if (!file.type.startsWith('image/')) {
    return showMessage('error', 'Vui lòng chọn file hình ảnh');
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const fullDataUrl = e.target.result;
    imageBase64 = fullDataUrl.split(',')[1];
    imagePreviewUrl = fullDataUrl;
    
    document.getElementById('imagePreview').src = imagePreviewUrl;
    document.getElementById('imageUploadPlaceholder').classList.add('hidden');
    document.getElementById('imagePreviewContainer').classList.remove('hidden');
    document.getElementById('imageUpload').classList.add('border-green-500');
    
    showMessage('success', `Đã tải ảnh (${(file.size/1024).toFixed(2)} KB)`);
  };
  reader.readAsDataURL(file);
}

function removeImage(event) {
  if (event) event.stopPropagation();
  
  imageBase64 = null;
  imagePreviewUrl = null;
  
  document.getElementById('imagePreview').src = '';
  document.getElementById('imageUploadPlaceholder').classList.remove('hidden');
  document.getElementById('imagePreviewContainer').classList.add('hidden');
  document.getElementById('imageUpload').classList.remove('border-green-500');
  document.getElementById('fileInput').value = '';
  
  showMessage('success', 'Đã xóa ảnh');
}

// ========== ATTRIBUTE MODAL ==========
function openAttributeModal() {
  try {
    currentAttributeLines = JSON.parse(document.getElementById('attributeLinesDisplay').value);
  } catch(e) {
    currentAttributeLines = [];
  }
  
  populateSelect('sizeTextSelect', availableAttributes.sizeText.values);
  populateSelect('colorSelect', availableAttributes.color.values);
  populateSelect('sizeNumberSelect', availableAttributes.sizeNumber.values);
  
  renderChips('sizeText');
  renderChips('color');
  renderChips('sizeNumber');
  
  document.getElementById('attributeModal').classList.remove('hidden');
}

function closeAttributeModal() {
  document.getElementById('attributeModal').classList.add('hidden');
}

function switchAttrTab(tab, event) {
  document.querySelectorAll('.attr-tab-content').forEach(el => el.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  
  document.querySelectorAll('#attributeModal button').forEach(btn => {
    btn.classList.remove('border-blue-500', 'text-blue-500');
    btn.classList.add('text-gray-500');
  });
  
  event.target.classList.add('border-blue-500', 'text-blue-500');
  event.target.classList.remove('text-gray-500');
}

function populateSelect(selectId, values) {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">-- Chọn --</option>';
  values.forEach(item => {
    select.innerHTML += `<option value="${item.Id}">${item.Name}</option>`;
  });
  
  select.onchange = (e) => {
    const valueId = parseInt(e.target.value);
    if (!valueId) return;
    
    const type = selectId.replace('Select', '');
    const attrConfig = availableAttributes[type];
    const selectedValue = attrConfig.values.find(v => v.Id === valueId);
    
    if (!selectedValue) return;
    
    let attrLine = currentAttributeLines.find(line => line.AttributeId === attrConfig.id);
    
    if (!attrLine) {
      attrLine = {
        Attribute: {
          Id: attrConfig.id,
          Name: attrConfig.name,
          Code: attrConfig.code,
          Sequence: null,
          CreateVariant: true
        },
        Values: [],
        AttributeId: attrConfig.id
      };
      currentAttributeLines.push(attrLine);
    }
    
    if (attrLine.Values.find(v => v.Id === valueId)) {
      showMessage('error', 'Giá trị đã được thêm');
      e.target.value = '';
      return;
    }
    
    attrLine.Values.push({
      Id: selectedValue.Id,
      Name: selectedValue.Name,
      Code: selectedValue.Code,
      Sequence: selectedValue.Sequence,
      AttributeId: attrConfig.id,
      AttributeName: attrConfig.name,
      PriceExtra: null,
      NameGet: `${attrConfig.name}: ${selectedValue.Name}`,
      DateCreated: null
    });
    
    renderChips(type);
    e.target.value = '';
  };
}

function renderChips(type) {
  const attrConfig = availableAttributes[type];
  const chipsContainer = document.getElementById(`${type}Chips`);
  chipsContainer.innerHTML = '';
  
  const attrLine = currentAttributeLines.find(line => line.AttributeId === attrConfig.id);
  
  if (!attrLine || !attrLine.Values || attrLine.Values.length === 0) {
    chipsContainer.innerHTML = '<p class="text-gray-400 text-sm">Chưa có giá trị</p>';
    return;
  }
  
  attrLine.Values.forEach(val => {
    const chip = document.createElement('div');
    chip.className = 'size-chip';
    chip.innerHTML = `
      <span>${val.Name}</span>
      <button class="size-chip-remove" onclick="ProductModule.removeValue('${type}', ${val.Id})">×</button>
    `;
    chipsContainer.appendChild(chip);
  });
}

function removeValue(type, valueId) {
  const attrConfig = availableAttributes[type];
  const attrLine = currentAttributeLines.find(line => line.AttributeId === attrConfig.id);
  
  if (!attrLine) return;
  
  attrLine.Values = attrLine.Values.filter(v => v.Id !== valueId);
  
  if (attrLine.Values.length === 0) {
    currentAttributeLines = currentAttributeLines.filter(line => line.AttributeId !== attrLine.AttributeId);
  }
  
  renderChips(type);
}

function saveAttributeLines() {
  document.getElementById('attributeLinesDisplay').value = JSON.stringify(currentAttributeLines, null, 2);
  closeAttributeModal();
  showMessage('success', 'Đã lưu biến thể');
}

// ========== GENERATE VARIANTS ==========
function generateVariants(productName, listPrice, attributeLines) {
  if (!attributeLines || attributeLines.length === 0) {
    return [];
  }
  
  // Get all attribute value combinations
  const combinations = [];
  
  function getCombinations(lines, current = [], index = 0) {
    if (index === lines.length) {
      combinations.push([...current]);
      return;
    }
    
    const line = lines[index];
    for (const value of line.Values) {
      current.push(value);
      getCombinations(lines, current, index + 1);
      current.pop();
    }
  }
  
  getCombinations(attributeLines);
  
  // Create variant for each combination
  return combinations.map(attrs => {
    const variantName = attrs.map(a => a.Name).join(', ');
    
    return {
      Id: 0,
      EAN13: null,
      DefaultCode: null,
      NameTemplate: productName,
      NameNoSign: null,
      ProductTmplId: 0,
      UOMId: 0,
      UOMName: null,
      UOMPOId: 0,
      QtyAvailable: 0,
      VirtualAvailable: 0,
      OutgoingQty: null,
      IncomingQty: null,
      NameGet: `${productName} (${variantName})`,
      POSCategId: null,
      Price: null,
      Barcode: null,
      Image: null,
      ImageUrl: null,
      Thumbnails: [],
      PriceVariant: listPrice,
      SaleOK: true,
      PurchaseOK: true,
      DisplayAttributeValues: null,
      LstPrice: 0,
      Active: true,
      ListPrice: 0,
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
      CategId: 0,
      CostMethod: null,
      InvoicePolicy: "order",
      Variant_TeamId: 0,
      Name: `${productName} (${variantName})`,
      PropertyCostMethod: null,
      PropertyValuation: null,
      PurchaseMethod: "receive",
      SaleDelay: 0,
      Tracking: null,
      Valuation: null,
      AvailableInPOS: true,
      CompanyId: null,
      IsCombo: null,
      NameTemplateNoSign: productName,
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
      InitInventory: 0,
      OrderTag: null,
      StringExtraProperties: null,
      CreatedById: null,
      TaxAmount: null,
      Error: null,
      AttributeValues: attrs.map(a => ({
        Id: a.Id,
        Name: a.Name,
        Code: null,
        Sequence: null,
        AttributeId: a.AttributeId,
        AttributeName: a.AttributeName,
        PriceExtra: null,
        NameGet: a.NameGet,
        DateCreated: null
      }))
    };
  });
}

// ========== PRODUCT CREATION ==========
async function createProductOneClick() {
  const defaultCode = document.getElementById('defaultCode').value.trim().toUpperCase();
  const productName = document.getElementById('productName').value.trim();
  const listPrice = parseFloat(document.getElementById('listPrice').value);
  const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
  const qtyAvailable = parseFloat(document.getElementById('qtyAvailable').value);
  
  if (!defaultCode || !productName) {
    return showMessage('error', '⚠️ Vui lòng nhập đầy đủ thông tin!');
  }
  
  try {
    showMessage('info', '🔍 Đang kiểm tra...');
    
    // Check if product exists
    const checkResponse = await fetch(
      `https://tomato.tpos.vn/odata/ProductTemplate/OdataService.GetViewV2?Active=true&DefaultCode=${defaultCode}`,
      { headers: getHeaders() }
    );
    const checkData = await checkResponse.json();
    
    if (checkData.value && checkData.value.length > 0) {
      showMessage('error', '❌ Sản phẩm đã tồn tại! Mã: ' + defaultCode);
      displayProductResult('❌ Sản phẩm đã tồn tại', checkData.value[0]);
      return;
    }
    
    showMessage('info', '✅ Đang tạo mới...');
    
    const attributeLines = JSON.parse(document.getElementById('attributeLinesDisplay').value);
    const productVariants = generateVariants(productName, listPrice, attributeLines);
    
    const payload = {
      Id: 0,
      Name: productName,
      Type: "product",
      ListPrice: listPrice,
      PurchasePrice: purchasePrice,
      DefaultCode: defaultCode,
      QtyAvailable: qtyAvailable,
      Image: imageBase64,
      ImageUrl: null,
      Thumbnails: [],
      AttributeLines: attributeLines,
      ProductVariants: productVariants,
      Active: true,
      SaleOK: true,
      PurchaseOK: true,
      UOMId: 1,
      UOMPOId: 1,
      CategId: 2,
      CompanyId: 1,
      Tracking: "none",
      InvoicePolicy: "order",
      PurchaseMethod: "receive",
      AvailableInPOS: true,
      DiscountSale: 0,
      DiscountPurchase: 0,
      StandardPrice: 0,
      Weight: 0,
      SaleDelay: 0,
      UOM: {
        Id: 1,
        Name: "Cái",
        Rounding: 0.001,
        Active: true,
        Factor: 1,
        FactorInv: 1,
        UOMType: "reference",
        CategoryId: 1,
        CategoryName: "Đơn vị"
      },
      UOMPO: {
        Id: 1,
        Name: "Cái",
        Rounding: 0.001,
        Active: true,
        Factor: 1,
        FactorInv: 1,
        UOMType: "reference",
        CategoryId: 1,
        CategoryName: "Đơn vị"
      },
      Categ: {
        Id: 2,
        Name: "Có thể bán",
        CompleteName: "Có thể bán",
        Type: "normal",
        PropertyCostMethod: "average",
        NameNoSign: "Co the ban",
        IsPos: true
      },
      Items: [],
      UOMLines: [],
      ComboProducts: [],
      ProductSupplierInfos: []
    };
    
    const response = await fetch(
      'https://tomato.tpos.vn/odata/ProductTemplate/ODataService.InsertV2?$expand=ProductVariants,UOM,UOMPO',
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      }
    );
    
    const data = await response.json();
    
    if (response.ok) {
      showMessage('success', '🎉 Tạo sản phẩm thành công! Mã: ' + defaultCode);
      displayProductResult('✅ Thành công', data);
      resetForm();
    } else {
      showMessage('error', '❌ Lỗi: ' + (data.error?.message || 'Unknown'));
      displayProductResult('❌ Lỗi', data);
    }
  } catch (error) {
    showMessage('error', '❌ Lỗi: ' + error.message);
  }
}

function displayProductResult(title, data) {
  document.getElementById('productResult').classList.remove('hidden');
  document.getElementById('productResultContent').textContent = JSON.stringify(data, null, 2);
}

function resetForm() {
  document.getElementById('productName').value = '';
  document.getElementById('defaultCode').value = 'NTEST';
  document.getElementById('attributeLinesDisplay').value = '[]';
  currentAttributeLines = [];
  if (imageBase64) removeImage();
}

// ========== EVENT LISTENERS ==========
function initProductModule(getHeadersFunc, showMessageFunc) {
  getHeaders = getHeadersFunc;
  showMessage = showMessageFunc;
  
  // Input uppercase transform
  const defaultCodeInput = document.getElementById('defaultCode');
  if (defaultCodeInput) {
    defaultCodeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }
  
  // Image upload click
  const imageUpload = document.getElementById('imageUpload');
  if (imageUpload) {
    imageUpload.addEventListener('click', () => {
      document.getElementById('fileInput').click();
    });
  }
  
  // File input change
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleImageFile(e.target.files[0]);
    });
  }
  
  // Paste image
  document.addEventListener('paste', (e) => {
    const items = e.clipboardData.items;
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        handleImageFile(item.getAsFile());
      }
    }
  });
}

// ========== EXPORTS ==========
const ProductModule = {
  initProductModule,
  openAttributeModal,
  closeAttributeModal,
  switchAttrTab,
  saveAttributeLines,
  removeValue,
  removeImage,
  createProductOneClick
};

// Make available globally
window.ProductModule = ProductModule;