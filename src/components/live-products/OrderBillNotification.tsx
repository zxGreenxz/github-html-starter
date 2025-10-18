import React from 'react';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface OrderBillProps {
  sessionIndex: string;
  phone?: string | null;
  customerName: string;
  productCode: string;
  productName: string;
  comment?: string | null;
  createdTime: string;
}

export function OrderBillNotification({
  sessionIndex,
  phone,
  customerName,
  productCode,
  productName,
  comment,
  createdTime,
}: OrderBillProps) {
  // Remove the number before the first space in product name
  const cleanedProductName = productName.replace(/^\d+\s+/, '');
  
  // Convert created_time to GMT+7
  const zonedDate = toZonedTime(new Date(createdTime), 'Asia/Bangkok');
  const formattedTime = format(zonedDate, 'dd/MM/yyyy HH:mm');

  return (
    <div className="space-y-2 font-mono text-sm text-center">
      <div className="text-[2.5em] font-bold leading-tight">
        #{sessionIndex} - {customerName}
      </div>
      <div className="font-semibold">{phone || 'Chưa có SĐT'}</div>
      <div>
        {productCode} - {cleanedProductName}
      </div>
      {comment && <div className="text-muted-foreground italic">{comment}</div>}
      <div className="text-xs text-muted-foreground">{formattedTime}</div>
    </div>
  );
}
