import { supabase } from "@/integrations/supabase/client";

export interface NetworkPrinter {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  bridgeUrl: string;
  isActive: boolean;
  createdAt: string;
}

export interface PrinterFormatSettings {
  width: number;
  height: number | null;
  threshold: number;
  scale: number;
  fontSession: number;
  fontPhone: number;
  fontCustomer: number;
  fontProduct: number;
  fontComment: number;
  padding: number;
  lineSpacing: number;
  alignment: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
}

export interface PrinterTemplate {
  id: string;
  name: string;
  width: string;
  customWidth: string;
  height: string;
  customHeight: string;
  threshold: string;
  scale: string;
  fontSession: string;
  fontPhone: string;
  fontCustomer: string;
  fontProduct: string;
  fontComment: string;
  padding: string;
  lineSpacing: string;
  alignment: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface BillData {
  sessionIndex: string;
  phone: string;
  customerName: string;
  productCode: string;
  productName: string;
  comment: string;
}

/**
 * Generate HTML for printing bill
 */
export const generatePrintHTML = (
  settings: PrinterFormatSettings,
  billData: BillData
): string => {
  const alignClass = settings.alignment;
  const fontWeight = settings.isBold ? '900' : 'normal';
  const fontStyle = settings.isItalic ? 'italic' : 'normal';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box;
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
        }
        html { 
          width: 100%;
          max-width: ${settings.width}px;
          overflow-x: hidden;
          background: white;
        }
        body { 
          width: ${settings.width}px;
          max-width: ${settings.width}px;
          margin: 0;
          padding: ${settings.padding}px;
          font-family: 'Arial Black', Arial, sans-serif; 
          font-weight: ${fontWeight};
          font-style: ${fontStyle};
          background: white;
          overflow-wrap: break-word;
          word-break: break-word;
        }
        div { 
          display: block;
          width: 100%;
          max-width: 100%;
          text-align: ${settings.alignment};
          word-wrap: break-word !important;
          overflow-wrap: break-word !important;
          word-break: break-word !important;
          white-space: normal !important;
          overflow: hidden;
        }
        .session { 
          font-size: ${settings.fontSession}px; 
          margin: ${settings.lineSpacing}px 0; 
          letter-spacing: 2px; 
          text-shadow: 2px 2px 0px #000;
        }
        .phone { 
          font-size: ${settings.fontPhone}px; 
          margin: ${settings.lineSpacing}px 0;
        }
        .customer { 
          font-size: ${settings.fontCustomer}px; 
          margin: ${settings.lineSpacing}px 0;
        }
        .product-code { 
          font-size: ${settings.fontProduct}px; 
          margin: ${settings.lineSpacing}px 0;
        }
        .product-name { 
          font-size: ${settings.fontProduct}px; 
          margin: ${settings.lineSpacing}px 0; 
          line-height: 1.4;
        }
        .comment { 
          font-size: ${settings.fontComment}px; 
          margin: ${settings.lineSpacing}px 0; 
          font-weight: 900;
        }
        .time { 
          font-size: ${settings.fontProduct - 8}px; 
          margin: ${settings.lineSpacing * 1.5}px 0;
        }
      </style>
    </head>
    <body>
      <div class="session">#${billData.sessionIndex}</div>
      ${billData.phone ? `<div class="phone">${billData.phone}</div>` : ''}
      <div class="customer">${billData.customerName}</div>
      <div class="product-code">${billData.productCode}</div>
      <div class="product-name">${billData.productName}</div>
      ${billData.comment ? `<div class="comment">${billData.comment}</div>` : ''}
      <div class="time">${new Date().toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}</div>
    </body>
    </html>
  `;
};

/**
 * Load printers from database
 */
export const loadPrinters = async (): Promise<NetworkPrinter[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('printer_configs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading printers:', error);
    return [];
  }

  return (data || []).map(p => ({
    id: p.id,
    name: p.name,
    ipAddress: p.ip_address,
    port: p.port,
    bridgeUrl: p.bridge_url,
    isActive: p.is_active,
    createdAt: p.created_at
  }));
};

/**
 * Save a printer to database
 */
export const savePrinter = async (printer: Omit<NetworkPrinter, 'id' | 'createdAt'>): Promise<NetworkPrinter | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Deactivate all printers if this one is active
  if (printer.isActive) {
    await supabase
      .from('printer_configs')
      .update({ is_active: false })
      .eq('user_id', user.id);
  }

  const { data, error } = await supabase
    .from('printer_configs')
    .insert({
      user_id: user.id,
      name: printer.name,
      ip_address: printer.ipAddress,
      port: printer.port,
      bridge_url: printer.bridgeUrl,
      is_active: printer.isActive
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving printer:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    ipAddress: data.ip_address,
    port: data.port,
    bridgeUrl: data.bridge_url,
    isActive: data.is_active,
    createdAt: data.created_at
  };
};

/**
 * Update a printer in database
 */
export const updatePrinter = async (id: string, updates: Partial<NetworkPrinter>): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Deactivate all printers if this one is being activated
  if (updates.isActive) {
    await supabase
      .from('printer_configs')
      .update({ is_active: false })
      .eq('user_id', user.id);
  }

  const dbUpdates: any = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.ipAddress !== undefined) dbUpdates.ip_address = updates.ipAddress;
  if (updates.port !== undefined) dbUpdates.port = updates.port;
  if (updates.bridgeUrl !== undefined) dbUpdates.bridge_url = updates.bridgeUrl;
  if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

  const { error } = await supabase
    .from('printer_configs')
    .update(dbUpdates)
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error updating printer:', error);
    return false;
  }

  return true;
};

/**
 * Delete a printer from database
 */
export const deletePrinter = async (id: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('printer_configs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting printer:', error);
    return false;
  }

  return true;
};

/**
 * Get the currently active printer
 */
export const getActivePrinter = async (): Promise<NetworkPrinter | null> => {
  const printers = await loadPrinters();
  return printers.find(p => p.isActive) || null;
};

/**
 * Save printer format settings to localStorage
 */
export interface SavedPrinterConfig {
  width: string;
  customWidth: string;
  height: string;
  customHeight: string;
  threshold: string;
  scale: string;
  fontSession: string;
  fontPhone: string;
  fontCustomer: string;
  fontProduct: string;
  fontComment: string;
  padding: string;
  lineSpacing: string;
  alignment: 'left' | 'center' | 'right';
  isBold: boolean;
  isItalic: boolean;
}

export const saveFormatSettings = async (settings: SavedPrinterConfig): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('printer_format_settings')
    .upsert({
      user_id: user.id,
      width: settings.width,
      custom_width: settings.customWidth,
      height: settings.height,
      custom_height: settings.customHeight,
      threshold: settings.threshold,
      scale: settings.scale,
      font_session: settings.fontSession,
      font_phone: settings.fontPhone,
      font_customer: settings.fontCustomer,
      font_product: settings.fontProduct,
      font_comment: settings.fontComment,
      padding: settings.padding,
      line_spacing: settings.lineSpacing,
      alignment: settings.alignment,
      is_bold: settings.isBold,
      is_italic: settings.isItalic
    }, { onConflict: 'user_id' });

  if (error) {
    console.error('Error saving format settings:', error);
    return false;
  }

  return true;
};

export const loadFormatSettings = async (): Promise<SavedPrinterConfig | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('printer_format_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) return null;

  return {
    width: data.width,
    customWidth: data.custom_width,
    height: data.height,
    customHeight: data.custom_height,
    threshold: data.threshold,
    scale: data.scale,
    fontSession: data.font_session,
    fontPhone: data.font_phone,
    fontCustomer: data.font_customer,
    fontProduct: data.font_product,
    fontComment: data.font_comment || "32",
    padding: data.padding,
    lineSpacing: data.line_spacing,
    alignment: data.alignment as 'left' | 'center' | 'right',
    isBold: data.is_bold,
    isItalic: data.is_italic
  };
};

/**
 * Template management functions
 */
export const loadTemplates = async (): Promise<PrinterTemplate[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('printer_templates')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading templates:', error);
    return [];
  }

  return (data || []).map(t => ({
    id: t.id,
    name: t.name,
    width: t.width,
    customWidth: t.custom_width,
    height: t.height,
    customHeight: t.custom_height,
    threshold: t.threshold,
    scale: t.scale,
    fontSession: t.font_session,
    fontPhone: t.font_phone,
    fontCustomer: t.font_customer,
    fontProduct: t.font_product,
    fontComment: t.font_comment || "32",
    padding: t.padding,
    lineSpacing: t.line_spacing,
    alignment: t.alignment as 'left' | 'center' | 'right',
    isBold: t.is_bold,
    isItalic: t.is_italic,
    isActive: t.is_active,
    createdAt: t.created_at
  }));
};

export const getActiveTemplate = async (): Promise<PrinterTemplate | null> => {
  const templates = await loadTemplates();
  return templates.find(t => t.isActive) || null;
};

export const createTemplate = async (name: string, settings: SavedPrinterConfig): Promise<PrinterTemplate | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('printer_templates')
    .insert({
      user_id: user.id,
      name,
      width: settings.width,
      custom_width: settings.customWidth,
      height: settings.height,
      custom_height: settings.customHeight,
      threshold: settings.threshold,
      scale: settings.scale,
      font_session: settings.fontSession,
      font_phone: settings.fontPhone,
      font_customer: settings.fontCustomer,
      font_product: settings.fontProduct,
      font_comment: settings.fontComment,
      padding: settings.padding,
      line_spacing: settings.lineSpacing,
      alignment: settings.alignment,
      is_bold: settings.isBold,
      is_italic: settings.isItalic,
      is_active: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating template:', error);
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    width: data.width,
    customWidth: data.custom_width,
    height: data.height,
    customHeight: data.custom_height,
    threshold: data.threshold,
    scale: data.scale,
    fontSession: data.font_session,
    fontPhone: data.font_phone,
    fontCustomer: data.font_customer,
    fontProduct: data.font_product,
    fontComment: data.font_comment || "32",
    padding: data.padding,
    lineSpacing: data.line_spacing,
    alignment: data.alignment as 'left' | 'center' | 'right',
    isBold: data.is_bold,
    isItalic: data.is_italic,
    isActive: data.is_active,
    createdAt: data.created_at
  };
};

export const setActiveTemplate = async (templateId: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Deactivate all templates
  await supabase
    .from('printer_templates')
    .update({ is_active: false })
    .eq('user_id', user.id);

  // Activate the selected template
  const { error } = await supabase
    .from('printer_templates')
    .update({ is_active: true })
    .eq('id', templateId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error setting active template:', error);
    return false;
  }

  return true;
};

export const deleteTemplate = async (templateId: string): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase
    .from('printer_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', user.id);

  if (error) {
    console.error('Error deleting template:', error);
    return false;
  }

  return true;
};

/**
 * Print HTML via bridge server
 */
export const printHTMLToXC80 = async (
  printer: NetworkPrinter,
  html: string,
  settings: {
    width: number;
    height: number | null;
    threshold: number;
    scale: number;
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload = {
      printerIp: printer.ipAddress,
      printerPort: printer.port,
      html: html,
      width: settings.width,
      height: settings.height,
      threshold: settings.threshold,
      scale: settings.scale
    };
    
    console.log('📤 Sending to bridge server:', {
      url: `${printer.bridgeUrl}/print/html`,
      width: payload.width,
      height: payload.height,
      threshold: payload.threshold,
      scale: payload.scale
    });
    
    const response = await fetch(`${printer.bridgeUrl}/print/html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Print error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Test printer connection via bridge server
 */
export const testPrinterConnection = async (
  printer: NetworkPrinter
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${printer.bridgeUrl}/health`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Connection test error:', error);
    return { success: false, error: error.message };
  }
};
