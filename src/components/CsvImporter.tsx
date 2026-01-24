import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
interface ImportProgress {
  current: number;
  total: number;
  status: 'idle' | 'parsing' | 'importing' | 'complete' | 'error';
  message: string;
}

interface ParsedSession {
  started_at: string;
  duration_seconds: number;
  source: string;
}

// Month mapping for German/English abbreviations
const monthMap: Record<string, number> = {
  'jan': 0, 'januar': 0, 'january': 0,
  'feb': 1, 'februar': 1, 'february': 1,
  'mär': 2, 'mar': 2, 'märz': 2, 'march': 2,
  'apr': 3, 'april': 3,
  'mai': 4, 'may': 4,
  'jun': 5, 'juni': 5, 'june': 5,
  'jul': 6, 'juli': 6, 'july': 6,
  'aug': 7, 'august': 7,
  'sep': 8, 'sept': 8, 'september': 8,
  'okt': 9, 'oct': 9, 'oktober': 9, 'october': 9,
  'nov': 10, 'november': 10,
  'dez': 11, 'dec': 11, 'dezember': 11, 'december': 11,
};

// Parse "D. MMM YYYY at HH:MM:SS" format
function parseATrackerDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const cleaned = dateStr.trim();
  
  // Match pattern: "1. Feb 2024 at 18:00:00"
  const match = cleaned.match(/^(\d{1,2})\.\s*(\w+)\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2}):(\d{2})$/i);
  
  if (match) {
    const [, day, monthStr, year, hours, minutes, seconds] = match;
    const monthLower = monthStr.toLowerCase();
    const month = monthMap[monthLower];
    
    if (month !== undefined) {
      return new Date(
        parseInt(year),
        month,
        parseInt(day),
        parseInt(hours),
        parseInt(minutes),
        parseInt(seconds)
      );
    }
  }
  
  // Fallback to native Date parsing
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Parse European decimal format (comma as decimal separator)
function parseEuropeanDecimal(value: string): number {
  if (!value) return 0;
  const cleaned = value.trim().replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Detect CSV separator from header line
function detectSeparator(headerLine: string): string {
  const semicolonCount = (headerLine.match(/;/g) || []).length;
  const commaCount = (headerLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line: string, separator: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
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

interface CsvImporterProps {
  onImportComplete?: () => void;
}

export function CsvImporter({ onImportComplete }: CsvImporterProps) {
  const [progress, setProgress] = useState<ImportProgress>({
    current: 0,
    total: 0,
    status: 'idle',
    message: 'Select a CSV file to import'
  });
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const parseCSV = useCallback((content: string): ParsedSession[] => {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) return [];

    const headerLine = lines[0];
    const separator = detectSeparator(headerLine);
    const headers = parseCSVLine(headerLine, separator).map(h => h.toLowerCase().trim());

    // Find column indices
    const startTimeIdx = headers.findIndex(h => 
      h.includes('start') && h.includes('time')
    );
    const durationIdx = headers.findIndex(h => 
      h.includes('duration') && h.includes('hour')
    );

    if (startTimeIdx === -1 || durationIdx === -1) {
      throw new Error('CSV must have "Start time" and "Duration in hours" columns');
    }

    const sessions: ParsedSession[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line, separator);
      
      const startTimeStr = values[startTimeIdx];
      const durationStr = values[durationIdx];

      const startDate = parseATrackerDate(startTimeStr);
      if (!startDate) continue;

      const durationHours = parseEuropeanDecimal(durationStr);
      const durationSeconds = Math.round(durationHours * 3600);

      if (durationSeconds <= 0) continue;

      sessions.push({
        started_at: startDate.toISOString(),
        duration_seconds: durationSeconds,
        source: 'csv_import'
      });
    }

    return sessions;
  }, []);

  const importToDatabase = useCallback(async (sessions: ParsedSession[]) => {
    if (!user) {
      throw new Error('You must be signed in to import data');
    }

    const BATCH_SIZE = 50;
    const total = sessions.length;
    
    setProgress({
      current: 0,
      total,
      status: 'importing',
      message: `Importing 0 of ${total} sessions...`
    });

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE).map(session => ({
        ...session,
        user_id: user.id, // Include user_id for RLS
      }));
      
      const { error } = await supabase
        .from('practice_sessions')
        .insert(batch);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const imported = Math.min(i + BATCH_SIZE, total);
      setProgress({
        current: imported,
        total,
        status: 'importing',
        message: `Importing ${imported} of ${total} sessions...`
      });

      // Small delay to prevent UI freeze
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    setProgress({
      current: total,
      total,
      status: 'complete',
      message: `Successfully imported ${total} sessions!`
    });
  }, [user]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV file',
        variant: 'destructive'
      });
      return;
    }

    try {
      setProgress({
        current: 0,
        total: 0,
        status: 'parsing',
        message: 'Parsing CSV file...'
      });

      const content = await file.text();
      const sessions = parseCSV(content);

      if (sessions.length === 0) {
        throw new Error('No valid sessions found in CSV');
      }

      setProgress({
        current: 0,
        total: sessions.length,
        status: 'parsing',
        message: `Found ${sessions.length} sessions. Starting import...`
      });

      await importToDatabase(sessions);

      toast({
        title: 'Import complete!',
        description: `Successfully imported ${sessions.length} practice sessions`
      });

      onImportComplete?.();

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setProgress({
        current: 0,
        total: 0,
        status: 'error',
        message: `Error: ${message}`
      });
      toast({
        title: 'Import failed',
        description: message,
        variant: 'destructive'
      });
    }
  }, [parseCSV, importToDatabase, toast, onImportComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const progressPercentage = progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          CSV Importer
        </CardTitle>
        <CardDescription>
          Upload your ATracker CSV export to import practice history
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dropzone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
            }
            ${progress.status === 'importing' || progress.status === 'parsing' 
              ? 'pointer-events-none opacity-50' 
              : 'cursor-pointer'
            }
          `}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
            id="csv-upload"
            disabled={progress.status === 'importing' || progress.status === 'parsing'}
          />
          <label htmlFor="csv-upload" className="cursor-pointer">
            <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag & drop your CSV here, or click to select
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Expected columns: Task name, Start time, End time, Duration in hours
            </p>
          </label>
        </div>

        {/* Progress */}
        {progress.status !== 'idle' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {progress.status === 'complete' && (
                <CheckCircle className="w-4 h-4 text-green-500" />
              )}
              {progress.status === 'error' && (
                <AlertCircle className="w-4 h-4 text-destructive" />
              )}
              <span className="text-sm text-muted-foreground">
                {progress.message}
              </span>
            </div>
            {(progress.status === 'importing' || progress.status === 'complete') && (
              <Progress value={progressPercentage} className="h-2" />
            )}
          </div>
        )}

        {/* Reset button after completion */}
        {(progress.status === 'complete' || progress.status === 'error') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setProgress({
              current: 0,
              total: 0,
              status: 'idle',
              message: 'Select a CSV file to import'
            })}
          >
            Import another file
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
