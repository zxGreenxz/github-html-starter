import { format as dateFnsFormat } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { vi } from 'date-fns/locale';

const VIETNAM_TZ = 'Asia/Bangkok'; // GMT+7

/**
 * Convert any date to GMT+7 timezone
 * @param date - Date object or ISO string
 * @returns Date object in GMT+7 timezone
 */
export const toVietnamTime = (date: Date | string): Date => {
  return toZonedTime(new Date(date), VIETNAM_TZ);
};

/**
 * Format date with custom pattern in GMT+7
 * @param date - Date object or ISO string
 * @param formatStr - date-fns format string
 * @returns Formatted date string
 */
export const formatVietnamDate = (
  date: Date | string, 
  formatStr: string = 'dd/MM/yyyy HH:mm'
): string => {
  const zonedDate = toVietnamTime(date);
  return dateFnsFormat(zonedDate, formatStr, { locale: vi });
};

/**
 * Get current time in GMT+7 as ISO string
 * @returns ISO string of current time in GMT+7
 */
export const nowVietnamISO = (): string => {
  const now = new Date();
  const zonedNow = toVietnamTime(now);
  return fromZonedTime(zonedNow, VIETNAM_TZ).toISOString();
};

/**
 * Convert to GMT+7 and return ISO string
 * @param date - Date object or ISO string
 * @returns ISO string in GMT+7
 */
export const toVietnamISO = (date: Date | string): string => {
  const zonedDate = toVietnamTime(date);
  return fromZonedTime(zonedDate, VIETNAM_TZ).toISOString();
};

/**
 * Quick format for datetime (dd/MM/yyyy HH:mm)
 * @param date - Date object or ISO string
 * @returns Formatted datetime string
 */
export const formatVietnamDateTime = (date: Date | string): string => {
  return formatVietnamDate(date, 'dd/MM/yyyy HH:mm');
};

/**
 * Quick format for time only (HH:mm:ss)
 * @param date - Date object or ISO string
 * @returns Formatted time string
 */
export const formatVietnamTime = (date: Date | string): string => {
  return formatVietnamDate(date, 'HH:mm:ss');
};

/**
 * Quick format for date only (dd/MM/yyyy)
 * @param date - Date object or ISO string
 * @returns Formatted date string
 */
export const formatVietnamDateOnly = (date: Date | string): string => {
  return formatVietnamDate(date, 'dd/MM/yyyy');
};
