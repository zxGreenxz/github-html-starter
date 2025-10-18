import jsPDF from 'jspdf';
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

/**
 * Generate simple bill PDF for thermal printer (80mm x 200mm)
 * Using fixed layout optimized for readability
 */
export const generateBillPDF = (data: BillData): jsPDF => {
  // Create PDF with 80mm x 200mm paper
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 200]
  });

  // Set font
  doc.setFont('helvetica');
  
  let yPosition = 8;

  // 1. Session Index (Large, Bold, Center)
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${data.sessionIndex}`, 40, yPosition, { align: 'center' });
  yPosition += 12;

  // 2. Phone (Bold, Center)
  if (data.phone) {
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text(data.phone, 40, yPosition, { align: 'center' });
    yPosition += 10;
  }

  // 3. Customer Name (Bold, Center)
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(data.customerName, 40, yPosition, { align: 'center' });
  yPosition += 10;

  // 4. Product Code (Normal, Left)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text(data.productCode, 5, yPosition);
  yPosition += 7;

  // 5. Product Name (Normal, Left, Wrap if long)
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  const cleanProductName = data.productName.replace(/^\d+\s+/, '');
  const nameLines = doc.splitTextToSize(cleanProductName, 70);
  nameLines.forEach((line: string) => {
    doc.text(line, 5, yPosition);
    yPosition += 6;
  });

  // 6. Comment (Capitalize, Center)
  if (data.comment) {
    yPosition += 2;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    const capitalizedComment = data.comment.charAt(0).toUpperCase() + data.comment.slice(1).toLowerCase();
    const commentLines = doc.splitTextToSize(capitalizedComment, 70);
    commentLines.forEach((line: string) => {
      doc.text(line, 40, yPosition, { align: 'center' });
      yPosition += 5;
    });
  }

  // 7. Created Time (Small, Center)
  yPosition += 3;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const zonedDate = toZonedTime(new Date(data.createdTime), 'Asia/Bangkok');
  const timeStr = format(zonedDate, 'dd/MM/yyyy HH:mm');
  doc.text(timeStr, 40, yPosition, { align: 'center' });

  return doc;
};
