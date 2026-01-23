import { parse, isValid } from 'date-fns';

export interface PracticeSession {
  taskName: string;
  startTime: Date;
  endTime: Date;
  duration: string;
  durationInHours: number;
}

// German month abbreviations mapping
const germanMonths: Record<string, string> = {
  'Jan': 'Jan',
  'Feb': 'Feb',
  'Mär': 'Mar',
  'Mar': 'Mar',
  'Apr': 'Apr',
  'Mai': 'May',
  'Jun': 'Jun',
  'Jul': 'Jul',
  'Aug': 'Aug',
  'Sep': 'Sep',
  'Okt': 'Oct',
  'Oct': 'Oct',
  'Nov': 'Nov',
  'Dez': 'Dec',
  'Dec': 'Dec',
};

/**
 * Parse German date format: "D. MMM YYYY at HH:MM:SS"
 * Example: "1. Feb 2024 at 18:00:00"
 */
export function parseGermanDate(dateStr: string): Date | null {
  try {
    // Replace German month abbreviations with English ones
    let normalizedDate = dateStr;
    for (const [german, english] of Object.entries(germanMonths)) {
      normalizedDate = normalizedDate.replace(german, english);
    }
    
    // Parse format: "D. MMM YYYY at HH:mm:ss"
    const parsed = parse(normalizedDate, "d. MMM yyyy 'at' HH:mm:ss", new Date());
    
    if (isValid(parsed)) {
      return parsed;
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Parse European decimal format (comma as decimal separator)
 * Example: "2,00000" -> 2.0
 */
export function parseEuropeanDecimal(value: string): number {
  const normalized = value.replace(',', '.');
  return parseFloat(normalized);
}

/**
 * Parse CSV content into PracticeSession array
 */
export function parseCSV(content: string): PracticeSession[] {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('CSV file must have headers and at least one data row');
  }
  
  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);
  
  // Find column indices
  const taskNameIdx = headers.findIndex(h => h.toLowerCase().includes('task name'));
  const startTimeIdx = headers.findIndex(h => h.toLowerCase().includes('start time'));
  const endTimeIdx = headers.findIndex(h => h.toLowerCase().includes('end time'));
  const durationIdx = headers.findIndex(h => h.toLowerCase() === 'duration');
  const durationHoursIdx = headers.findIndex(h => h.toLowerCase().includes('duration in hours'));
  
  if (startTimeIdx === -1 || durationHoursIdx === -1) {
    throw new Error('CSV must contain "Start time" and "Duration in hours" columns');
  }
  
  const sessions: PracticeSession[] = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < Math.max(startTimeIdx, durationHoursIdx) + 1) {
      continue; // Skip malformed rows
    }
    
    const startTime = parseGermanDate(values[startTimeIdx]);
    if (!startTime) {
      console.warn(`Could not parse date on row ${i + 1}: ${values[startTimeIdx]}`);
      continue;
    }
    
    const durationInHours = parseEuropeanDecimal(values[durationHoursIdx]);
    if (isNaN(durationInHours)) {
      console.warn(`Could not parse duration on row ${i + 1}: ${values[durationHoursIdx]}`);
      continue;
    }
    
    sessions.push({
      taskName: taskNameIdx !== -1 ? values[taskNameIdx] : '',
      startTime,
      endTime: endTimeIdx !== -1 ? (parseGermanDate(values[endTimeIdx]) || startTime) : startTime,
      duration: durationIdx !== -1 ? values[durationIdx] : '',
      durationInHours,
    });
  }
  
  return sessions;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
