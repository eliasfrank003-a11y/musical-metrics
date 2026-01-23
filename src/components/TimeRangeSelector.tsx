interface TimeRangeSelectorProps {
  selectedRange: '1W' | '1M' | '1Y' | 'ALL';
  onRangeChange: (range: '1W' | '1M' | '1Y' | 'ALL') => void;
}

const ranges: Array<'1W' | '1M' | '1Y' | 'ALL'> = ['1W', '1M', '1Y', 'ALL'];

export function TimeRangeSelector({ selectedRange, onRangeChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {ranges.map((range) => (
        <button
          key={range}
          onClick={() => onRangeChange(range)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            selectedRange === range
              ? 'bg-primary text-primary-foreground shadow-glow'
              : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
          }`}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
