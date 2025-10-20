-- Add font_comment column to printer_format_settings table
ALTER TABLE printer_format_settings
ADD COLUMN IF NOT EXISTS font_comment TEXT DEFAULT '32';

-- Add font_comment column to printer_templates table
ALTER TABLE printer_templates
ADD COLUMN IF NOT EXISTS font_comment TEXT DEFAULT '32';