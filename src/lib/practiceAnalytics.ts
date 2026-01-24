import { startOfDay, differenceInDays, addDays, format, subDays, subMonths, subYears } from 'date-fns';
import { PracticeSession } from './csvParser';

export interface DailyData {
  date: Date;
  dateStr: string;
  hoursPlayed: number;
  cumulativeHours: number;
  cumulativeAverage: number;
  dayNumber: number;
}

export interface AnalyticsResult {
  dailyData: DailyData[];
  totalHours: number;
  totalDays: number;
  currentAverage: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Process practice sessions into daily analytics data
 */
export function calculateAnalytics(sessions: PracticeSession[]): AnalyticsResult {
  if (sessions.length === 0) {
    throw new Error('No valid practice sessions found');
  }

  // Step A: Aggregate hours by date
  const dailyHours = new Map<string, number>();
  
  for (const session of sessions) {
    const dateKey = format(startOfDay(session.startTime), 'yyyy-MM-dd');
    const current = dailyHours.get(dateKey) || 0;
    dailyHours.set(dateKey, current + session.durationInHours);
  }
  
  // Find date range - extend to today if needed
  const dates = Array.from(dailyHours.keys()).sort();
  const startDate = new Date(dates[0]);
  const lastSessionDateStr = dates[dates.length - 1];
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  // Compare as strings (ISO format sorts correctly) to avoid timezone issues
  const endDateStr = lastSessionDateStr > todayStr ? lastSessionDateStr : todayStr;
  const endDate = new Date(endDateStr);
  
  // Step B & C: Create continuous timeline with zero-filling
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const dailyData: DailyData[] = [];
  
  let cumulativeHours = 0;
  
  for (let i = 0; i < totalDays; i++) {
    const currentDate = addDays(startDate, i);
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const hoursPlayed = dailyHours.get(dateKey) || 0;
    
    cumulativeHours += hoursPlayed;
    const dayNumber = i + 1;
    const cumulativeAverage = cumulativeHours / dayNumber;
    
    dailyData.push({
      date: currentDate,
      dateStr: dateKey,
      hoursPlayed,
      cumulativeHours,
      cumulativeAverage,
      dayNumber,
    });
  }
  
  const totalHours = cumulativeHours;
  const currentAverage = totalHours / totalDays;
  
  return {
    dailyData,
    totalHours,
    totalDays,
    currentAverage,
    startDate,
    endDate,
  };
}

// Visual start date to hide early volatility in the chart
// The math still calculates from the true start, but display begins here
const VISUAL_START_DATE = new Date('2024-03-01');

/**
 * Filter data by time range
 */
export function filterDataByRange(
  data: DailyData[],
  range: '1W' | '1M' | '6M' | '1Y' | 'ALL',
  endDate: Date
): DailyData[] {
  if (data.length === 0) {
    return data;
  }
  
  let startDate: Date;
  
  switch (range) {
    case 'ALL':
      // For ALL view, start from the visual start date to hide early volatility
      startDate = VISUAL_START_DATE;
      break;
    case '1W':
      startDate = subDays(endDate, 7);
      break;
    case '1M':
      startDate = subMonths(endDate, 1);
      break;
    case '6M':
      startDate = subMonths(endDate, 6);
      break;
    case '1Y':
      startDate = subYears(endDate, 1);
      break;
    default:
      return data;
  }
  
  // Filter by calculated start date, but also ensure we don't show before VISUAL_START_DATE
  // for longer ranges (1Y, 6M, ALL) where early volatility would be visible
  const effectiveStartDate = range === '1W' || range === '1M' 
    ? startDate 
    : new Date(Math.max(startDate.getTime(), VISUAL_START_DATE.getTime()));
  
  return data.filter(d => d.date >= effectiveStartDate && d.date <= endDate);
}

/**
 * Downsample data for smoother visualization on longer timeframes
 */
export function downsampleData(data: DailyData[], targetPoints: number = 100): DailyData[] {
  if (data.length <= targetPoints) {
    return data;
  }
  
  const step = Math.ceil(data.length / targetPoints);
  const result: DailyData[] = [];
  
  for (let i = 0; i < data.length; i += step) {
    // For downsampling, take the last point of each chunk to show accurate average
    const endIdx = Math.min(i + step - 1, data.length - 1);
    result.push(data[endIdx]);
  }
  
  // Always include the last data point
  if (result[result.length - 1] !== data[data.length - 1]) {
    result.push(data[data.length - 1]);
  }
  
  return result;
}

/**
 * Calculate delta between two points
 */
export function calculateDelta(data: DailyData[]): { value: number; percentage: number } {
  if (data.length < 2) {
    return { value: 0, percentage: 0 };
  }
  
  const first = data[0].cumulativeAverage;
  const last = data[data.length - 1].cumulativeAverage;
  const value = last - first;
  const percentage = first !== 0 ? ((last - first) / first) * 100 : 0;
  
  return { value, percentage };
}

/**
 * Format hours as "Xh Ym" string
 */
export function formatHoursMinutes(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  return `${h}h ${m}m`;
}

/**
 * Format delta as "+Xm Ys" or "-Xm Ys" with seconds
 */
export function formatDelta(hours: number): string {
  const totalSeconds = Math.round(Math.abs(hours) * 3600);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  
  if (m === 0 && s === 0) {
    return '0s';
  }
  
  const signPrefix = hours >= 0 ? '+' : '-';
  
  if (m === 0) {
    return `${signPrefix}${s}s`;
  }
  
  if (s === 0) {
    return `${signPrefix}${m}m`;
  }
  
  return `${signPrefix}${m}m ${s}s`;
}
