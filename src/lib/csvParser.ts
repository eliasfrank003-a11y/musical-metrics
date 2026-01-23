export interface PracticeSession {
  taskName: string;
  startTime: Date;
  endTime: Date;
  duration: string;
  durationInHours: number;
}

// Month name mapping (German and English)
const monthMap: Record<string, number> = {
  'jan': 0, 'januar': 0,
  'feb': 1, 'februar': 1,
  'mar': 2, 'mär': 2, 'märz': 2,
  'apr': 3, 'april': 3,
  'may': 4, 'mai': 4,
  'jun': 5, 'juni': 5,
  'jul': 6, 'juli': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'oct': 9, 'okt': 9, 'oktober': 9,
  'nov': 10, 'november': 10,
  'dec': 11, 'dez': 11, 'dezember': 11,
};

/**
 * Parse date format: "D. MMM YYYY at HH:MM:SS"
 * Example: "1. Feb 2024 at 18:00:00"
 * Also handles: "1. Februar 2024 at 18:00:00"
 */
export function parseGermanDate(dateStr: string): Date | null {
  try {
    if (!dateStr || typeof dateStr !== 'string') {
      return null;
    }

    // Normalize the string
    const normalized = dateStr.trim().toLowerCase();
    
    // Try regex pattern: "D. Month YYYY at HH:MM:SS"
    const pattern = /^(\d{1,2})\.\s*(\w+)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2}):(\d{2})$/i;
    const match = normalized.match(pattern);
    
    if (match) {
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const second = parseInt(match[6], 10);
      
      const month = monthMap[monthStr];
      
      if (month === undefined) {
        console.warn(`Unknown month: ${monthStr}`);
        return null;
      }
      
      const date = new Date(year, month, day, hour, minute, second);
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date;
    }
    
    // Fallback: try native Date parsing
    const fallbackDate = new Date(dateStr);
    if (!isNaN(fallbackDate.getTime())) {
      return fallbackDate;
    }
    
    return null;
  } catch (error) {
    console.warn('Date parsing error:', error);
    return null;
  }
}

/**
 * Parse European decimal format (comma as decimal separator)
 * Example: "2,00000" -> 2.0
 */
export function parseEuropeanDecimal(value: string): number {
  if (!value || typeof value !== 'string') {
    return NaN;
  }
  // Replace comma with dot and remove any whitespace
  const normalized = value.trim().replace(',', '.');
  return parseFloat(normalized);
}

/**
 * Parse CSV content into PracticeSession array
 */
export function parseCSV(content: string): PracticeSession[] {
  // Handle both \r\n and \n line endings
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  console.log(`[CSV Parser] Found ${lines.length} lines`);
  
  if (lines.length < 2) {
    throw new Error('CSV file must have headers and at least one data row');
  }
  
  // Parse headers (first line)
  const headers = parseCSVLine(lines[0]);
  console.log('[CSV Parser] Headers:', headers);
  
  // Find column indices (case-insensitive, partial match)
  const startTimeIdx = headers.findIndex(h => 
    h.toLowerCase().includes('start') && h.toLowerCase().includes('time')
  );
  const endTimeIdx = headers.findIndex(h => 
    h.toLowerCase().includes('end') && h.toLowerCase().includes('time')
  );
  const durationHoursIdx = headers.findIndex(h => 
    h.toLowerCase().includes('duration') && h.toLowerCase().includes('hours')
  );
  const taskNameIdx = headers.findIndex(h => 
    h.toLowerCase().includes('task') && h.toLowerCase().includes('name')
  );
  const durationIdx = headers.findIndex(h => 
    h.toLowerCase() === 'duration'
  );
  
  console.log('[CSV Parser] Column indices:', { startTimeIdx, endTimeIdx, durationHoursIdx, taskNameIdx });
  
  if (startTimeIdx === -1) {
    throw new Error(`Could not find "Start time" column. Found headers: ${headers.join(', ')}`);
  }
  
  if (durationHoursIdx === -1) {
    throw new Error(`Could not find "Duration in hours" column. Found headers: ${headers.join(', ')}`);
  }
  
  const sessions: PracticeSession[] = [];
  const errors: string[] = [];
  
  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    
    if (values.length < Math.max(startTimeIdx, durationHoursIdx) + 1) {
      errors.push(`Row ${i + 1}: Not enough columns`);
      continue;
    }
    
    const startTimeStr = values[startTimeIdx];
    const startTime = parseGermanDate(startTimeStr);
    
    if (!startTime) {
      errors.push(`Row ${i + 1}: Could not parse date "${startTimeStr}"`);
      continue;
    }
    
    const durationStr = values[durationHoursIdx];
    const durationInHours = parseEuropeanDecimal(durationStr);
    
    if (isNaN(durationInHours)) {
      errors.push(`Row ${i + 1}: Could not parse duration "${durationStr}"`);
      continue;
    }
    
    sessions.push({
      taskName: taskNameIdx !== -1 ? values[taskNameIdx] || '' : '',
      startTime,
      endTime: endTimeIdx !== -1 ? (parseGermanDate(values[endTimeIdx]) || startTime) : startTime,
      duration: durationIdx !== -1 ? values[durationIdx] || '' : '',
      durationInHours,
    });
  }
  
  console.log(`[CSV Parser] Parsed ${sessions.length} sessions, ${errors.length} errors`);
  if (errors.length > 0 && errors.length <= 5) {
    console.warn('[CSV Parser] Errors:', errors);
  } else if (errors.length > 5) {
    console.warn(`[CSV Parser] First 5 errors:`, errors.slice(0, 5));
  }
  
  return sessions;
}

/**
 * Parse a single CSV line, handling quoted values and different separators
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  // Detect separator (comma or semicolon)
  const hasSemicolon = line.includes(';') && !line.includes(',');
  const separator = hasSemicolon ? ';' : ',';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === separator && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}
