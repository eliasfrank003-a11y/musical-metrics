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
 * Calculate intraday average evolution for the 1D view using the Plateau-Slope model
 * 
 * Logic:
 * - Baseline: Yesterday's final average (horizontal dashed line)
 * - Starting Point (00:00): Total Previous Playtime / (Total Previous Days + 1)
 * - Idle Periods: Horizontal plateaus (no decay)
 * - Practice Sessions: Linear upward slopes
 * - Post-Practice: New horizontal plateau at higher value
 */
export function calculateIntradayData(
  dailyData: DailyData[],
  sessions: { started_at: string; duration_seconds: number }[]
): { intradayData: IntradayData[]; baselineAverage: number } {
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
    return { intradayData: [], baselineAverage: 0 };
  }
  
  // Yesterday's final average is the baseline (the target line)
  const baselineAverage = baselineData.cumulativeAverage;
  const baselineHours = baselineData.cumulativeHours;
  const baselineDays = baselineData.dayNumber;
  
  // Today is day (baselineDays + 1)
  const todayDayNumber = baselineDays + 1;
  
  // Get today's sessions
  const todaySessions = sessions
    .filter(s => {
      const sessionDate = new Date(s.started_at);
      return isSameDay(sessionDate, today);
    })
    .map(s => ({
      startTime: new Date(s.started_at),
      endTime: new Date(new Date(s.started_at).getTime() + s.duration_seconds * 1000),
      durationHours: s.duration_seconds / 3600,
    }))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  
  // Generate data points - we need points at session boundaries for accurate slopes
  const intradayData: IntradayData[] = [];
  let cumulativeTodayHours = 0;
  
  // Calculate average: (baselineHours + todayHours) / todayDayNumber
  const calcAverage = (todayHours: number) => 
    (baselineHours + todayHours) / todayDayNumber;
  
  // Only show up to current hour (or all 24 if viewing historical day)
  const maxHour = isToday(today) ? currentHour : 23;
  
  // Create a set of important time points (hour boundaries + session boundaries)
  const timePoints: Date[] = [];
  
  // Add hourly points
  for (let hour = 0; hour <= maxHour; hour++) {
    timePoints.push(addHours(today, hour));
  }
  
  // Add session start and end points (if within our time range)
  for (const session of todaySessions) {
    if (session.startTime.getHours() <= maxHour) {
      timePoints.push(session.startTime);
    }
    if (session.endTime.getHours() <= maxHour || 
        (session.endTime.getHours() === maxHour && session.endTime.getMinutes() === 0)) {
      timePoints.push(session.endTime);
    }
  }
  
  // Sort and deduplicate time points
  const sortedTimePoints = [...new Set(timePoints.map(t => t.getTime()))]
    .sort((a, b) => a - b)
    .map(t => new Date(t));
  
  // Process each time point
  for (const time of sortedTimePoints) {
    const hour = time.getHours();
    const minute = time.getMinutes();
    
    // Calculate cumulative hours at this exact moment
    let hoursAtThisPoint = 0;
    let hoursPlayedThisInterval = 0;
    
    for (const session of todaySessions) {
      if (time >= session.endTime) {
        // Session fully completed before this point
        hoursAtThisPoint += session.durationHours;
      } else if (time > session.startTime && time < session.endTime) {
        // Currently in the middle of this session
        const elapsedMs = time.getTime() - session.startTime.getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        hoursAtThisPoint += elapsedHours;
      }
      
      // Check if this point is during a session (for display purposes)
      if (time >= session.startTime && time <= session.endTime) {
        hoursPlayedThisInterval = session.durationHours;
      }
    }
    
    const cumulativeAverage = calcAverage(hoursAtThisPoint);
    
    intradayData.push({
      time,
      timeStr: format(time, 'HH:mm'),
      hourOfDay: hour,
      cumulativeAverage,
      hoursPlayedThisInterval,
      isCurrentHour: hour === currentHour && isToday(today),
    });
  }
  
  return { intradayData, baselineAverage };
}
