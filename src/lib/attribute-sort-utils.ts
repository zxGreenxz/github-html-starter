export function sortAttributeValues<T extends { value: string; attributeName: string }>(
  values: T[],
  attributeName: string
): T[] {
  const sorted = [...values];

  if (attributeName === "Màu") {
    // Màu đơn trước, màu đôi sau
    return sorted.sort((a, b) => {
      const aWords = a.value.trim().split(/\s+/).length;
      const bWords = b.value.trim().split(/\s+/).length;
      
      if (aWords !== bWords) {
        return aWords - bWords;
      }
      
      // Cùng số từ → sort alphabet
      return a.value.localeCompare(b.value, 'vi');
    });
  }

  if (attributeName === "Size Số") {
    // Sort theo số tăng dần
    return sorted.sort((a, b) => {
      const aNum = parseInt(a.value);
      const bNum = parseInt(b.value);
      
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
      const aUpper = a.value.toUpperCase();
      const bUpper = b.value.toUpperCase();
      
      const aIndex = sizeOrder.indexOf(aUpper);
      const bIndex = sizeOrder.indexOf(bUpper);
      
      // Cả 2 đều trong list → so sánh index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // a trong list, b ngoài list → a trước
      if (aIndex !== -1) return -1;
      
      // b trong list, a ngoài list → b trước
      if (bIndex !== -1) return 1;
      
      // Cả 2 ngoài list → sort alphabet
      return a.value.localeCompare(b.value, 'vi');
    });
  }

  // Thuộc tính khác → giữ nguyên thứ tự
  return sorted;
}
