import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileLoad: (content: string) => void;
  isLoading?: boolean;
}

export function FileUpload({ onFileLoad, isLoading }: FileUploadProps) {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        readFile(file);
      }
    },
    [onFileLoad]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        readFile(file);
      }
    },
    [onFileLoad]
  );

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      onFileLoad(content);
    };
    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="relative group"
    >
      <input
        type="file"
        accept=".csv"
        onChange={handleChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        disabled={isLoading}
      />
      <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-xl transition-all duration-300 group-hover:border-primary group-hover:bg-secondary/50">
        <div className="flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-secondary transition-all duration-300 group-hover:bg-primary/20 group-hover:shadow-glow">
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-7 h-7 text-muted-foreground transition-colors group-hover:text-primary" />
          )}
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">
          {isLoading ? 'Processing...' : 'Upload Practice Data'}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Drag and drop your CSV file here, or click to browse
        </p>
        <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span>Accepts .csv files</span>
        </div>
      </div>
    </div>
  );
}
