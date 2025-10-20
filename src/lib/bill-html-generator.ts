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
 * Generate bill HTML optimized for Puppeteer printing
 * Full width (80mm), bold text, compact layout
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
