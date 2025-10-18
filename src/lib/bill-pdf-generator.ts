import jsPDF from 'jspdf';
import { BillTemplate, BillField } from '@/types/bill-template';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface BillData {
  sessionIndex: string;
  phone?: string | null;
  customerName: string;
  productCode: string;
  productName: string;
  comment?: string | null;
  createdTime: string;
  price?: number;
  quantity?: number;
}

export const generateBillPDF = (
  template: BillTemplate,
  data: BillData
): jsPDF => {
  // Create PDF with paper width and height
  const widthMm = template.paperWidth;
  const heightMm = template.paperHeight;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm]
  });

  // Set font
  doc.setFont(template.styles.fontFamily.toLowerCase());

  let yPosition = template.styles.padding.top;

  // Sort fields by order
  const sortedFields = [...template.fields]
    .filter(f => f.visible)
    .sort((a, b) => a.order - b.order);

  sortedFields.forEach((field) => {
    const value = formatFieldValue(field, data);
    if (!value) return;

    // Apply font settings
    doc.setFontSize(field.fontSize);
    doc.setFont(
      template.styles.fontFamily.toLowerCase(),
      field.fontWeight === 'bold' ? 'bold' : 'normal'
    );

    // Calculate available width for text (accounting for padding)
    const maxWidth = widthMm - template.styles.padding.left - template.styles.padding.right;
    
    // Split text into lines if it's too long
    const lines = doc.splitTextToSize(value, maxWidth);
    
    // Calculate line height
    const lineHeight = field.fontSize * template.styles.lineSpacing * 0.3527; // pt to mm

    // Calculate x position based on alignment
    let xPosition = template.styles.padding.left;
    
    if (field.align === 'center') {
      xPosition = widthMm / 2;
    } else if (field.align === 'right') {
      xPosition = widthMm - template.styles.padding.right;
    }

    // Add text lines
    lines.forEach((line: string, index: number) => {
      doc.text(line, xPosition, yPosition + (index * lineHeight), { align: field.align });
    });

    // Move to next field (accounting for number of lines)
    yPosition += (lines.length * lineHeight);
  });

  return doc;
};

const formatFieldValue = (field: BillField, data: BillData): string => {
  let value = '';

  switch (field.key) {
    case 'sessionIndex':
      value = `#${data.sessionIndex}`;
      break;
    case 'phone':
      value = data.phone || 'Chưa có SĐT';
      break;
    case 'customerName':
      value = data.customerName;
      break;
    case 'productCode':
      value = data.productCode;
      break;
    case 'productName':
      value = data.productName.replace(/^\d+\s+/, '');
      break;
    case 'comment':
      value = data.comment || '';
      break;
    case 'createdTime':
      const zonedDate = toZonedTime(new Date(data.createdTime), 'Asia/Bangkok');
      value = format(zonedDate, 'dd/MM/yyyy HH:mm');
      break;
    case 'price':
      value = data.price ? `${data.price.toLocaleString('vi-VN')} đ` : '';
      break;
    case 'quantity':
      value = data.quantity ? `SL: ${data.quantity}` : '';
      break;
  }

  if (field.label) {
    value = `${field.label}${value}`;
  }

  if (field.transform) {
    switch (field.transform) {
      case 'uppercase':
        value = value.toUpperCase();
        break;
      case 'lowercase':
        value = value.toLowerCase();
        break;
      case 'capitalize':
        value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
        break;
    }
  }

  return value;
};
