'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ku } from '@/lib/translations';

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export function CsvImportModal({ open, onClose, onSuccess }: CsvImportModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [preview, setPreview] = useState<string[][]>([]);
  const [allPreviewRows, setAllPreviewRows] = useState<string[][]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [showAllPreview, setShowAllPreview] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (open) {
      const scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollY}px`;
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [open]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setShowAllPreview(false);

    // Read and preview all rows
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const rows = lines.map(line => {
        // Handle CSV parsing with potential commas in values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      });
      setAllPreviewRows(rows);
      setPreview(rows.slice(0, 6));
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  const downloadExampleCSV = () => {
    const exampleContent = `ژمارە,ناوی سیانی,لەدایکبوون,ناونیشان,ژمارەی مۆبایل,بارى دارایی,وانە
1,ئاراس محمد عبدالله,2012,هەولێر - ڕزگاری,07501234567,باش,شەممە بەیانی
2,هیڤی ئەحمەد حسین,2013,هەولێر - عەینکاوە,07512345678,باش,شەممە عەسر
3,کارزان خالد محمود,2011,هەولێر - بەختیاری,07523456789,ناوەند,دووشەممە عەسر
4,شاد ئومێد حمید,2014,هەولێر - شۆرش,07534567890,کەم,چوارشەممە عەسر`;
    
    const blob = new Blob(['\ufeff' + exampleContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example-students.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    toast({ title: 'فایلی نمونە داگیرا' });
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('gender', gender);

      const res = await fetch('/api/students/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult({
        success: true,
        imported: data.imported,
        skipped: data.skipped || 0,
        errors: data.errors || [],
      });

      const skippedMsg = data.skipped > 0 ? ` (${data.skipped} دووبارە بوون)` : '';
      toast({
        title: `${data.imported} ${ku.csv.rowsImported}${skippedMsg}`,
      });

      if (data.imported > 0) {
        setTimeout(() => {
          onSuccess();
        }, 1500);
      }
    } catch (error: any) {
      setResult({
        success: false,
        imported: 0,
        skipped: 0,
        errors: [error.message],
      });
      toast({
        title: ku.csv.error,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setPreview([]);
    setAllPreviewRows([]);
    setResult(null);
    setShowAllPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddAnother = () => {
    resetModal();
    // Keep the modal open but reset everything for new import
    toast({ title: 'ئامادەیە بۆ هاوردەکردنی فایلی نوێ' });
  };

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        className="bg-white w-full md:max-w-lg md:rounded-2xl rounded-t-2xl flex flex-col animate-slide-up"
        style={{ 
          maxHeight: 'calc(100vh - env(safe-area-inset-top, 0px) - 1rem)',
          marginBottom: 'env(safe-area-inset-bottom, 0px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between z-10 rounded-t-2xl">
          <h2 className="text-lg font-bold text-gray-900">{ku.csv.title}</h2>
          <button
            onClick={() => { resetModal(); onClose(); }}
            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div 
          className="flex-1 overflow-auto p-4 space-y-4 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Download Example CSV Button */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={downloadExampleCSV}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors"
            >
              <Download className="w-5 h-5" />
              <span className="font-medium">داگرتنی CSV نمونە</span>
            </button>
          </div>
          {/* Gender Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {ku.students.gender}
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setGender('male')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  gender === 'male'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.students.male}
              </button>
              <button
                type="button"
                onClick={() => setGender('female')}
                className={`flex-1 py-3 rounded-xl font-medium transition-colors ${
                  gender === 'female'
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {ku.students.female}
              </button>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {!file ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">{ku.csv.dragDrop}</p>
                <p className="text-sm text-gray-400 mt-1">CSV files only</p>
              </button>
            ) : (
              <div className="border-2 border-primary rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                    <p className="text-sm text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={resetModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">{ku.csv.preview}</h3>
                <span className="text-xs text-gray-500">
                  {allPreviewRows.length} ڕیز
                  {allPreviewRows.length > 6 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAllPreview(!showAllPreview);
                        setPreview(showAllPreview ? allPreviewRows.slice(0, 6) : allPreviewRows);
                      }}
                      className="mr-2 text-primary font-medium"
                    >
                      {showAllPreview ? 'کەمتر' : 'هەموو'}
                    </button>
                  )}
                </span>
              </div>
              <div className="overflow-auto border rounded-xl max-h-60">
                <table className="w-full text-sm">
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className={i === 0 ? 'bg-gray-100 font-medium sticky top-0' : ''}>
                        {row.map((cell, j) => (
                          <td key={j} className="px-3 py-2 border-b whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                ستوونەکان: ژمارە، ناوی سیانی، ساڵی لەدایکبوون، ناونیشان، ژمارەی مۆبایل، بارى دارایی، وانە
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-xl p-4 ${
              result.success ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className="flex items-center gap-3">
                {result.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-red-600" />
                )}
                <div className="flex-1">
                  <p className={`font-medium ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.success 
                      ? `${result.imported} ${ku.csv.rowsImported}`
                      : ku.csv.error
                    }
                  </p>
                  {result.success && result.skipped > 0 && (
                    <p className="text-sm text-amber-600 mt-1">
                      {result.skipped} خوێندکار پێشتر بوون (دووبارە زیادنەکران)
                    </p>
                  )}
                  {result.errors.length > 0 && (
                    <p className="text-sm text-red-600 mt-1">
                      {result.errors[0]}
                    </p>
                  )}
                </div>
              </div>
              {result.success && (
                <button
                  type="button"
                  onClick={handleAddAnother}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-white border border-green-300 text-green-700 hover:bg-green-50"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>هاوردەکردنی فایلی تر</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Fixed Footer with Import Button */}
        {file && !result?.success && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 safe-bottom">
            <Button
              onClick={handleImport}
              className="w-full mobile-btn bg-primary text-white"
              disabled={isLoading}
            >
              {isLoading ? ku.csv.importing : ku.csv.import}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
