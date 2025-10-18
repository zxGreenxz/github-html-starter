// Time utility functions for livestream reports

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface TimeDisplayData {
  timeRange: string;
  duration: string;
}

// Parse time string to minutes for calculation
export const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Convert minutes back to HH:MM format
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Calculate duration between two times
export const calculateDuration = (startTime: string, endTime: string): string => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  if (endMinutes <= startMinutes) {
    return "0h0p";
  }
  
  const durationMinutes = endMinutes - startMinutes;
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  
  return `${hours}h${minutes}p`;
};

// Format time range for storage (HH:MM - HH:MM + duration)
export const formatTimeRangeForStorage = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return "";
  
  const duration = calculateDuration(startTime, endTime);
  return `${startTime} - ${endTime}\n${duration}`;
};

// Parse stored time range for display
export const parseTimeRangeForDisplay = (storedValue: string): TimeDisplayData => {
  if (!storedValue) {
    return { timeRange: "-", duration: "" };
  }
  
  // Check if it's new format (contains - and newline)
  if (storedValue.includes(' - ') && storedValue.includes('\n')) {
    const [timeRange, duration] = storedValue.split('\n');
    return { timeRange, duration };
  }
  
  // Old format (just duration like "2h30p")
  return { timeRange: "-", duration: storedValue };
};

// Parse stored time range for editing (extract start and end times)
export const parseTimeRangeForEdit = (storedValue: string): TimeRange => {
  if (!storedValue) {
    return { startTime: "", endTime: "" };
  }
  
  // Check if it's new format
  if (storedValue.includes(' - ')) {
    const timeRangePart = storedValue.split('\n')[0];
    const [startTime, endTime] = timeRangePart.split(' - ');
    return { startTime: startTime.trim(), endTime: endTime.trim() };
  }
  
  // Old format - return empty for manual input
  return { startTime: "", endTime: "" };
};

// Validate time format (HH:MM)
export const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

// Validate time range (end time must be after start time)
export const isValidTimeRange = (startTime: string, endTime: string): boolean => {
  if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
    return false;
  }
  
  return timeToMinutes(endTime) > timeToMinutes(startTime);
};