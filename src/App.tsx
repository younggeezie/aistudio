/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { 
  Upload, 
  Search, 
  FileText, 
  X, 
  Download, 
  Hash, 
  AlertCircle,
  ChevronRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Keyword {
  text: string;
  operator: 'required' | 'excluded' | 'optional';
  color: string;
}

const COLORS = [
  'bg-amber-200 text-amber-900',
  'bg-blue-200 text-blue-900',
  'bg-emerald-200 text-emerald-900',
  'bg-rose-200 text-rose-900',
  'bg-purple-200 text-purple-900',
  'bg-indigo-200 text-indigo-900',
  'bg-cyan-200 text-cyan-900',
];

export default function App() {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [keywordsInput, setKeywordsInput] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterView, setIsFilterView] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const keywords = useMemo<Keyword[]>(() => {
    return keywordsInput
      .split(/[,|\n]/)
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .map((k, i) => {
        let operator: 'required' | 'excluded' | 'optional' = 'optional';
        let text = k;
        if (k.startsWith('+')) {
          operator = 'required';
          text = k.substring(1).trim();
        } else if (k.startsWith('-')) {
          operator = 'excluded';
          text = k.substring(1).trim();
        }
        return { text, operator, color: COLORS[i % COLORS.length] };
      })
      .filter(k => k.text.length > 0);
  }, [keywordsInput]);

  const handleFileUpload = (file: File) => {
    if (!file) return;
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      setError('File is too large. Please upload a file smaller than 50MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        setFileContent(content);
        setFileName(file.name);
        if (file.size > 10 * 1024 * 1024) {
          setError('Large file detected. Highlighting and filtering may be slower.');
        } else {
          setError(null);
        }
      }
    };
    reader.onerror = () => setError('Failed to read file.');
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const stats = useMemo(() => {
    if (!fileContent || keywords.length === 0) return [];

    return keywords.map((kw) => {
      const escaped = kw.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      const matches = fileContent.match(regex);
      return {
        keyword: kw.text,
        operator: kw.operator,
        count: matches ? matches.length : 0,
        color: kw.color
      };
    });
  }, [fileContent, keywords]);

  const checkLineMatch = useCallback((line: string) => {
    if (keywords.length === 0) return true;

    const required = keywords.filter(k => k.operator === 'required');
    const excluded = keywords.filter(k => k.operator === 'excluded');
    const optional = keywords.filter(k => k.operator === 'optional');

    const lowerLine = line.toLowerCase();

    // Must NOT contain any excluded
    if (excluded.some(k => lowerLine.includes(k.text.toLowerCase()))) return false;

    // Must contain ALL required
    if (required.length > 0) {
      if (!required.every(k => lowerLine.includes(k.text.toLowerCase()))) return false;
    }

    // If no required, must contain at least one optional (if any optional exist)
    if (required.length === 0 && optional.length > 0) {
      if (!optional.some(k => lowerLine.includes(k.text.toLowerCase()))) return false;
    }

    return true;
  }, [keywords]);

  const renderHighlightedLine = (line: string, lineIndex: number) => {
    const isMatch = checkLineMatch(line);
    
    if (isFilterView && !isMatch) return null;

    if (keywords.length === 0) return <div key={lineIndex}>{line}</div>;

    // Only highlight non-excluded keywords
    const activeKeywords = keywords.filter(k => k.operator !== 'excluded');
    if (activeKeywords.length === 0) return <div key={lineIndex} className={cn(!isMatch && "opacity-30")}>{line}</div>;

    const sortedKeywords = [...activeKeywords].sort((a, b) => b.text.length - a.text.length);
    const pattern = sortedKeywords
      .map(k => k.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = line.split(regex);

    return (
      <div key={lineIndex} className={cn("transition-opacity duration-200", !isMatch && "opacity-30")}>
        {parts.map((part, i) => {
          const kw = sortedKeywords.find(k => k.text.toLowerCase() === part.toLowerCase());
          if (kw) {
            return (
              <mark 
                key={i} 
                className={cn(
                  "px-0.5 rounded-sm font-medium transition-colors duration-200",
                  kw.color
                )}
              >
                {part}
              </mark>
            );
          }
          return part;
        })}
      </div>
    );
  };

  const highlightedContent = useMemo(() => {
    if (!fileContent) return null;
    const lines = fileContent.split(/\r?\n/);
    return lines.map((line, i) => renderHighlightedLine(line, i));
  }, [fileContent, keywords, isFilterView, checkLineMatch]);

  const downloadFiltered = () => {
    if (!fileContent) return;

    const lines = fileContent.split(/\r?\n/);
    const filteredLines = lines.filter(checkLineMatch);

    const blob = new Blob([filteredLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filtered_${fileName || 'results.txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearFile = () => {
    setFileContent('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1C1E] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Filter size={18} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Keyword Parser</h1>
          </div>
          
          <div className="flex items-center gap-3">
            {fileContent && (
              <>
                <div className="flex items-center bg-gray-100 p-1 rounded-lg mr-2">
                  <button
                    onClick={() => setIsFilterView(false)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      !isFilterView ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Full View
                  </button>
                  <button
                    onClick={() => setIsFilterView(true)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      isFilterView ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Matches Only
                  </button>
                </div>
                <button
                  onClick={downloadFiltered}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Download size={16} />
                  <span>Export Matches</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upload Section */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Upload size={14} />
              Source File
            </h2>
            
            <div
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative border-2 border-dashed rounded-xl p-8 transition-all cursor-pointer group",
                isDragging 
                  ? "border-blue-500 bg-blue-50" 
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              )}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
                accept=".txt,.log,.csv,.json,.md"
              />
              
              <div className="flex flex-col items-center text-center">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors",
                  isDragging ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200"
                )}>
                  <FileText size={24} />
                </div>
                {fileName ? (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{fileName}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-900">Click or drag file</p>
                    <p className="text-xs text-gray-500 mt-1">TXT, LOG, CSV, JSON (max 50MB)</p>
                  </>
                )}
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2 text-red-600 text-xs"
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </motion.div>
            )}
          </section>

          {/* Keywords Section */}
          <section className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Search size={14} />
                Keywords
              </h2>
              <div className="group relative">
                <AlertCircle size={14} className="text-gray-400 cursor-help" />
                <div className="absolute right-0 top-6 w-48 p-3 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl leading-relaxed">
                  <p className="font-bold mb-1">Search Operators:</p>
                  <p><span className="text-blue-400 font-mono">+term</span>: Must be present (AND)</p>
                  <p><span className="text-red-400 font-mono">-term</span>: Must NOT be present (NOT)</p>
                  <p><span className="text-gray-400 font-mono">term</span>: Optional (OR)</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <textarea
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="Use + for required, - for excluded..."
                className="w-full h-32 p-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none placeholder:text-gray-400"
              />
              <div className="flex flex-wrap gap-2">
                {keywords.map((kw, i) => (
                  <span 
                    key={i}
                    className={cn(
                      "px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1.5",
                      kw.color
                    )}
                  >
                    <span className="opacity-50 font-mono">
                      {kw.operator === 'required' ? '+' : kw.operator === 'excluded' ? '-' : ''}
                    </span>
                    {kw.text}
                    <button 
                      onClick={() => {
                        const newKws = keywords.filter((_, idx) => idx !== i);
                        setKeywordsInput(newKws.map(k => (k.operator === 'required' ? '+' : k.operator === 'excluded' ? '-' : '') + k.text).join(', '));
                      }}
                      className="hover:opacity-70"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <AnimatePresence>
            {stats.length > 0 && (
              <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm"
              >
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Hash size={14} />
                  Occurrences
                </h2>
                <div className="space-y-2">
                  {stats.map((stat, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", stat.color.split(' ')[0])} />
                        <span className="text-sm font-medium text-gray-700">
                          {stat.keyword}
                          {stat.operator !== 'optional' && (
                            <span className={cn(
                              "ml-1.5 text-[10px] uppercase tracking-tighter px-1 rounded",
                              stat.operator === 'required' ? "bg-blue-100 text-blue-600" : "bg-red-100 text-red-600"
                            )}>
                              {stat.operator === 'required' ? 'AND' : 'NOT'}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className="text-sm font-mono font-bold text-gray-900">{stat.count}</span>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Content Viewer */}
        <div className="lg:col-span-8">
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden min-h-[600px]">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-600">
                  {fileName || 'No file selected'}
                </span>
                {isFilterView && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded-full uppercase tracking-wider">
                    Filtering Active
                  </span>
                )}
              </div>
              {fileContent && (
                <div className="text-xs text-gray-400 font-mono">
                  {fileContent.length.toLocaleString()} characters
                </div>
              )}
            </div>
            
            <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap bg-white">
              {fileContent ? (
                <div className="relative">
                  {highlightedContent}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4 py-20">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100">
                    <FileText size={32} className="opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className="text-base font-medium text-gray-500">Viewer is empty</p>
                    <p className="text-sm">Upload a file to start parsing keywords</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 text-center text-gray-400 text-xs">
        <p>&copy; 2026 Keyword File Parser &bull; Built with precision</p>
      </footer>
    </div>
  );
}
