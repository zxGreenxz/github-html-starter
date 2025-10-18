/**
 * Format currency in VND (Vietnamese Dong)
 * @param value - The numeric value to format (should be the actual value from database)
 * @returns Formatted string like "50.000 đ"
 */
export function formatVND(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} đ`;
}
