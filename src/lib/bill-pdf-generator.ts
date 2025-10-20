import jsPDF from "jspdf";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

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
 * Generate bill PDF optimized for full width thermal printer (80mm)
 * Bold text and proper sizing
 */
export const generateBillPDF = (data: BillData): jsPDF => {
  // Create PDF with 80mm width (full thermal printer size)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [80, 150],
  });

  doc.setFont("helvetica");

  let yPosition = 6;

  // 1. Session Index (Large, Extra Bold)
  doc.setFontSize(32);
  doc.setFont("helvetica", "bold");
  doc.text(`#${data.sessionIndex}`, 40, yPosition, { align: "center" });
  yPosition += 12;

  // 2. Phone Number (Bold)
  if (data.phone) {
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(data.phone, 40, yPosition, { align: "center" });
    yPosition += 9;
  }

  // 3. Customer Name (Bold)
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(data.customerName, 40, yPosition, { align: "center" });
  yPosition += 9;

  // 4. Product Code (Bold)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.productCode, 5, yPosition);
  yPosition += 7;

  // 5. Product Name (Bold, Auto-wrap)
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const cleanProductName = data.productName.replace(/^\d+\s+/, "");
  const nameLines = doc.splitTextToSize(cleanProductName, 70);
  nameLines.forEach((line: string) => {
    doc.text(line, 5, yPosition);
    yPosition += 6;
  });

  // 6. Comment (Bold Italic)
  if (data.comment) {
    yPosition += 2;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bolditalic");
    const capitalizedComment = data.comment.charAt(0).toUpperCase() + data.comment.slice(1).toLowerCase();
    const commentLines = doc.splitTextToSize(capitalizedComment, 70);
    commentLines.forEach((line: string) => {
      doc.text(line, 40, yPosition, { align: "center" });
      yPosition += 5;
    });
  }

  // 7. Price & Quantity
  if (data.price || data.quantity) {
    yPosition += 2;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");

    let priceText = "";
    if (data.quantity) priceText += `SL: ${data.quantity} `;
    if (data.price) priceText += `- ${data.price.toLocaleString("vi-VN")}đ`;

    doc.text(priceText.trim(), 40, yPosition, { align: "center" });
    yPosition += 6;
  }

  // 8. Created Time (Bold)
  yPosition += 2;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  const zonedDate = toZonedTime(new Date(data.createdTime), "Asia/Bangkok");
  const timeStr = format(zonedDate, "dd/MM/yyyy HH:mm");
  doc.text(timeStr, 40, yPosition, { align: "center" });

  // 9. Separator line
  yPosition += 5;
  doc.setLineWidth(0.5);
  doc.line(5, yPosition, 75, yPosition);

  // 10. Thank you
  yPosition += 5;
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Cảm ơn quý khách!", 40, yPosition, { align: "center" });

  return doc;
};

/**
 * Generate bill PDF and return as base64 string
 */
export const generateBillPDFBase64 = (data: BillData): string => {
  const doc = generateBillPDF(data);
  const pdfOutput = doc.output("datauristring");

  const base64Match = pdfOutput.match(/^data:application\/pdf;[^,]*base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Failed to generate PDF base64");
  }

  return base64Match[1];
};

/**
 * Generate compact bill as HTML with bold text
 * Optimized for 80mm thermal printer with full width
 */
export const generateBillHTML = (data: BillData): string => {
  const zonedDate = toZonedTime(new Date(data.createdTime), "Asia/Bangkok");
  const timeStr = format(zonedDate, "dd/MM/yyyy HH:mm");
  const cleanProductName = data.productName.replace(/^\d+\s+/, "");
  const capitalizedComment = data.comment
    ? data.comment.charAt(0).toUpperCase() + data.comment.slice(1).toLowerCase()
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          width: 80mm;
          margin: 0;
          padding: 5mm;
          font-family: 'Arial Black', 'Arial', sans-serif;
          background: white;
          font-weight: 900;
        }
        .session-index {
          text-align: center;
          font-size: 36px;
          font-weight: 900;
          margin: 6px 0;
          letter-spacing: 2px;
          text-shadow: 1px 1px 0px #000;
        }
        .phone, .customer-name {
          text-align: center;
          font-size: 26px;
          font-weight: 900;
          margin: 5px 0;
          letter-spacing: 1px;
        }
        .product-code {
          font-size: 18px;
          font-weight: 900;
          margin: 5px 0;
        }
        .product-name {
          font-size: 18px;
          font-weight: 900;
          margin: 5px 0;
          line-height: 1.4;
        }
        .comment {
          text-align: center;
          font-size: 16px;
          font-weight: 900;
          font-style: italic;
          margin: 8px 0;
        }
        .price-info {
          text-align: center;
          font-size: 16px;
          font-weight: 900;
          margin: 6px 0;
        }
        .time {
          text-align: center;
          font-size: 14px;
          font-weight: 900;
          margin: 8px 0;
          color: #222;
        }
        .separator {
          border-top: 3px dashed #000;
          margin: 8px 0;
        }
        .thank-you {
          text-align: center;
          font-size: 14px;
          font-weight: 900;
          margin-top: 6px;
        }
      </style>
    </head>
    <body>
      <div class="session-index">#${data.sessionIndex}</div>
      ${data.phone ? `<div class="phone">${data.phone}</div>` : ""}
      <div class="customer-name">${data.customerName}</div>
      <div class="product-code">${data.productCode}</div>
      <div class="product-name">${cleanProductName}</div>
      ${data.comment ? `<div class="comment">${capitalizedComment}</div>` : ""}
      ${
        data.price || data.quantity
          ? `
        <div class="price-info">
          ${data.quantity ? `SL: ${data.quantity}` : ""} 
          ${data.price ? `- ${data.price.toLocaleString("vi-VN")}đ` : ""}
        </div>
      `
          : ""
      }
      <div class="time">${timeStr}</div>
      <div class="separator"></div>
      <div class="thank-you">Cảm ơn quý khách!</div>
    </body>
    </html>
  `;
};
