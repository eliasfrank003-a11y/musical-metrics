interface TimeRangeSelectorProps {
  selectedRange: '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL';
  onRangeChange: (range: '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL') => void;
}

const ranges: Array<{ key: '1D' | '1W' | '1M' | '6M' | '1Y' | 'ALL'; label: string }> = [
  { key: '1D', label: '1D' },
  { key: '1W', label: '1W' },
  { key: '1M', label: '1M' },
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'Max' },
];

export function TimeRangeSelector({ selectedRange, onRangeChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex items-center justify-start gap-6">
      {ranges.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onRangeChange(key)}
          className={`text-lg font-semibold transition-colors duration-200 ${
            selectedRange === key
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/70'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
