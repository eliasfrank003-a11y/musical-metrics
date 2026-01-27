import { startOfDay, differenceInDays, addDays, format, subDays, subMonths, subYears, addHours, startOfHour, isToday, isSameDay } from 'date-fns';
import { PracticeSession } from './csvParser';

export interface DailyData {
  date: Date;
  dateStr: string;
  hoursPlayed: number;
  cumulativeHours: number;
  cumulativeAverage: number;
  dayNumber: number;
}

// Intraday data point for 1D view
export interface IntradayData {
  time: Date;
  timeStr: string;
  hourOfDay: number;
  cumulativeAverage: number;
  hoursPlayedThisInterval: number;
  isCurrentHour: boolean;
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
  const startDate = startOfDay(new Date(dates[0]));
  const lastSessionDate = startOfDay(new Date(dates[dates.length - 1]));
  const today = startOfDay(new Date());
  // Always extend to today (or beyond if future sessions exist)
  const endDate = lastSessionDate > today ? lastSessionDate : today;
  
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
  range: '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL',
  endDate: Date
): DailyData[] {
  if (data.length === 0) {
    return data;
  }
  
  // 1D is handled separately - return today's data point for baseline
  if (range === '1D') {
    const today = startOfDay(new Date());
    return data.filter(d => isSameDay(d.date, today));
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

/**
 * Calculate intraday average evolution for the 1D view
 * Shows how the lifetime average changes throughout the day at hourly intervals
 */
export function calculateIntradayData(
  dailyData: DailyData[],
  sessions: { started_at: string; duration_seconds: number }[]
): IntradayData[] {
  const today = startOfDay(new Date());
  const now = new Date();
  const currentHour = now.getHours();
  
  // Get yesterday's cumulative data (baseline for today)
  const yesterdayData = dailyData.find(d => 
    isSameDay(d.date, subDays(today, 1))
  );
  
  // If no yesterday data, use the last available data point before today
  const baselineData = yesterdayData || dailyData.filter(d => d.date < today).pop();
  
  if (!baselineData) {
    // No historical data, return empty
    return [];
  }
  
  const baselineHours = baselineData.cumulativeHours;
  const baselineDays = baselineData.dayNumber;
  
  // Get today's sessions and organize by hour
  const todaySessions = sessions.filter(s => {
    const sessionDate = new Date(s.started_at);
    return isSameDay(sessionDate, today);
  });
  
  // Create hourly breakdown of practice time
  const hourlyPractice = new Map<number, number>();
  
  for (const session of todaySessions) {
    const startTime = new Date(session.started_at);
    const endTime = new Date(startTime.getTime() + session.duration_seconds * 1000);
    const startHour = startTime.getHours();
    const endHour = endTime.getHours();
    
    // Distribute session time across hours if it spans multiple hours
    if (startHour === endHour) {
      const current = hourlyPractice.get(startHour) || 0;
      hourlyPractice.set(startHour, current + session.duration_seconds / 3600);
    } else {
      // Session spans multiple hours - distribute proportionally
      for (let h = startHour; h <= endHour; h++) {
        let hoursInThisSlot = 0;
        if (h === startHour) {
          hoursInThisSlot = (60 - startTime.getMinutes()) / 60;
        } else if (h === endHour) {
          hoursInThisSlot = endTime.getMinutes() / 60;
        } else {
          hoursInThisSlot = 1;
        }
        const current = hourlyPractice.get(h) || 0;
        hourlyPractice.set(h, current + hoursInThisSlot);
      }
    }
  }
  
  // Generate intraday data points for each hour
  const intradayData: IntradayData[] = [];
  let cumulativeTodayHours = 0;
  
  // Only show hours up to current hour (or all 24 if viewing historical day)
  const maxHour = isToday(today) ? currentHour : 23;
  
  for (let hour = 0; hour <= maxHour; hour++) {
    const practiceThisHour = hourlyPractice.get(hour) || 0;
    cumulativeTodayHours += practiceThisHour;
    
    // Calculate the "effective" day count at this point in the day
    // At hour 0, we're at the start of a new day (dayNumber = baselineDays + fraction)
    // The fraction represents how much of the day has passed
    const fractionOfDay = (hour + 1) / 24;
    const effectiveDays = baselineDays + fractionOfDay;
    
    // Calculate the cumulative average at this point
    const totalHours = baselineHours + cumulativeTodayHours;
    const cumulativeAverage = totalHours / effectiveDays;
    
    const time = addHours(today, hour);
    
    intradayData.push({
      time,
      timeStr: format(time, 'HH:mm'),
      hourOfDay: hour,
      cumulativeAverage,
      hoursPlayedThisInterval: practiceThisHour,
      isCurrentHour: hour === currentHour && isToday(today),
    });
  }
  
  return intradayData;
}
