export function sortAttributeValues<T extends { value: string; attributeName: string }>(
  values: T[],
  attributeName: string
): T[] {
  const sorted = [...values];

  if (attributeName === "Màu") {
    // Sort: Màu đơn (1 từ) trước, màu đôi (2+ từ) sau
    return sorted.sort((a, b) => {
      const aWords = a.value.trim().split(/\s+/).length;
      const bWords = b.value.trim().split(/\s+/).length;
      
      // Khác số từ → sort theo số từ
      if (aWords !== bWords) {
        return aWords - bWords;
      }
      
      // Cùng số từ → sort alphabet (tiếng Việt)
      return a.value.localeCompare(b.value, 'vi');
    });
  }

  if (attributeName === "Size Số") {
    // Sort theo số tăng dần
    return sorted.sort((a, b) => {
      const aNum = parseInt(a.value);
      const bNum = parseInt(b.value);
      
      // Nếu không phải số → sort alphabet
      if (isNaN(aNum) || isNaN(bNum)) {
        return a.value.localeCompare(b.value, 'vi');
      }
      
      return aNum - bNum;
    });
  }

  if (attributeName === "Size Chữ") {
    // Sort theo thứ tự chuẩn
    const sizeOrder = ["S", "M", "L", "XL", "XXL", "XXXL"];
    
    return sorted.sort((a, b) => {
      const aUpper = a.value.toUpperCase().trim();
      const bUpper = b.value.toUpperCase().trim();
      
      const aIndex = sizeOrder.indexOf(aUpper);
      const bIndex = sizeOrder.indexOf(bUpper);
      
      // Cả 2 đều trong list chuẩn → so sánh index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // a trong list, b không → a trước
      if (aIndex !== -1) return -1;
      
      // b trong list, a không → b trước
      if (bIndex !== -1) return 1;
      
      // Cả 2 ngoài list → sort alphabet
      return a.value.localeCompare(b.value, 'vi');
    });
  }

  // Thuộc tính khác → giữ nguyên thứ tự
  return sorted;
}
