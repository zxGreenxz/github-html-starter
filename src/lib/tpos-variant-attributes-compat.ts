// Compatibility layer for old variant-attributes imports
import { TPOS_ATTRIBUTES } from "./tpos-attributes";

export const TPOS_ATTRIBUTE_IDS = {
  SIZE_TEXT: 1,
  COLOR: 3,
  SIZE_NUMBER: 4
};

export { TPOS_ATTRIBUTES };

export interface TPOSAttributeValue {
  Id: number;
  Name: string;
  Code: string;
  Sequence: number | null;
  AttributeId?: number;
  AttributeName?: string;
}

export const TPOS_SIZE_TEXT_MAP: Record<string, TPOSAttributeValue> = {};
export const TPOS_COLOR_MAP: Record<string, TPOSAttributeValue> = {};
export const TPOS_SIZE_NUMBER_MAP: Record<string, TPOSAttributeValue> = {};

TPOS_ATTRIBUTES.sizeText.forEach(item => {
  TPOS_SIZE_TEXT_MAP[item.Name] = { ...item, AttributeId: 1, AttributeName: "Size Chữ" };
});

TPOS_ATTRIBUTES.color.forEach(item => {
  TPOS_COLOR_MAP[item.Name] = { ...item, AttributeId: 3, AttributeName: "Màu" };
});

TPOS_ATTRIBUTES.sizeNumber.forEach(item => {
  TPOS_SIZE_NUMBER_MAP[item.Name] = { ...item, AttributeId: 4, AttributeName: "Size Số" };
});

export type VariantType = 'color' | 'text-size' | 'number-size' | 'unknown';

export function getVariantType(variant: string): VariantType {
  if (TPOS_COLOR_MAP[variant]) return 'color';
  if (TPOS_SIZE_TEXT_MAP[variant]) return 'text-size';
  if (TPOS_SIZE_NUMBER_MAP[variant]) return 'number-size';
  return 'unknown';
}
