export interface BillTemplate {
  id: string;
  name: string;
  paperWidth: number; // 58mm to 100mm
  paperHeight: number; // 100mm to 400mm
  fields: BillField[];
  styles: BillStyles;
}

export interface BillField {
  id: string;
  key: 'sessionIndex' | 'customerName' | 'phone' | 'productCode' | 'productName' | 'comment' | 'createdTime' | 'price' | 'quantity';
  label?: string; // Optional prefix, e.g., "Khách hàng: "
  order: number;
  visible: boolean;
  fontSize: number; // pt
  fontWeight: 'normal' | 'bold';
  align: 'left' | 'center' | 'right';
  transform?: 'uppercase' | 'lowercase' | 'capitalize';
}

export interface BillStyles {
  fontFamily: string;
  lineSpacing: number; // multiplier
  padding: { top: number; right: number; bottom: number; left: number }; // mm
}

export const DEFAULT_BILL_TEMPLATE: BillTemplate = {
  id: 'default',
  name: 'Template mặc định',
  paperWidth: 80,
  paperHeight: 200,
  fields: [
    { id: '1', key: 'sessionIndex', order: 1, visible: true, fontSize: 32, fontWeight: 'bold', align: 'center' },
    { id: '2', key: 'phone', order: 2, visible: true, fontSize: 24, fontWeight: 'bold', align: 'center' },
    { id: '3', key: 'customerName', order: 3, visible: true, fontSize: 24, fontWeight: 'bold', align: 'center' },
    { id: '4', key: 'productCode', order: 4, visible: true, fontSize: 16, fontWeight: 'normal', align: 'left' },
    { id: '5', key: 'productName', order: 5, visible: true, fontSize: 16, fontWeight: 'normal', align: 'left' },
    { id: '6', key: 'comment', order: 6, visible: true, fontSize: 14, fontWeight: 'normal', align: 'center', transform: 'capitalize' },
    { id: '7', key: 'createdTime', order: 7, visible: true, fontSize: 12, fontWeight: 'normal', align: 'center' },
  ],
  styles: {
    fontFamily: 'Arial',
    lineSpacing: 1.2,
    padding: { top: 5, right: 5, bottom: 5, left: 5 }
  }
};
