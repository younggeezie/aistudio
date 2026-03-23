/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { 
  Upload, 
  Search, 
  FileText, 
  X, 
  Download, 
  Hash, 
  AlertCircle,
  ChevronRight,
  Filter,
  Sun,
  Moon,
  List as ListIcon,
  Clock,
  Trash2,
  Calendar,
  ShieldAlert,
  Activity,
  CheckSquare,
  Maximize2,
  Minimize2,
  WrapText,
  ArrowRight,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

/** Utility for tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Keyword {
  text: string;
  operator: 'required' | 'excluded' | 'optional';
  color: string;
}

interface SystemHighlight {
  pattern: string;
  color: string;
  type: 'timestamp' | 'level' | 'id' | 'network';
}

const SYSTEM_HIGHLIGHTS: SystemHighlight[] = [
  {
    pattern: '\\b(?:ERROR|FATAL|CRITICAL)\\b',
    color: 'text-red-500 font-bold dark:text-red-400',
    type: 'level'
  },
  {
    pattern: '\\b(?:WARN|WARNING)\\b',
    color: 'text-amber-500 font-bold dark:text-amber-400',
    type: 'level'
  },
  {
    pattern: '\\b(?:INFO)\\b',
    color: 'text-blue-500 font-bold dark:text-blue-400',
    type: 'level'
  },
  {
    pattern: '\\b(?:DEBUG|TRACE)\\b',
    color: 'text-gray-500 font-bold dark:text-gray-400',
    type: 'level'
  },
  {
    pattern: '\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z?',
    color: 'text-emerald-600 dark:text-emerald-400',
    type: 'timestamp'
  },
  {
    pattern: '\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b',
    color: 'text-purple-500 dark:text-purple-400',
    type: 'id'
  },
  {
    pattern: '\\b\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\b',
    color: 'text-cyan-600 dark:text-cyan-400',
    type: 'network'
  }
];

interface LineObject {
  text: string;
  originalIndex: number;
}

interface RowData {
  lines: LineObject[];
  keywords: Keyword[];
  checkLineMatch: (line: string) => boolean;
  highlightRegex: RegExp | null;
  sortedKeywords: Keyword[];
  wrapLines: boolean;
}

const SYSTEM_HIGHLIGHTS_COMPILED = SYSTEM_HIGHLIGHTS.map(s => ({
  ...s,
  regex: new RegExp(`^${s.pattern}$`, 'i'),
  searchRegex: new RegExp(s.pattern, 'i')
}));

const Row = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: RowData }) => {
  const { lines, keywords, checkLineMatch, highlightRegex, sortedKeywords, wrapLines } = data;
  const lineObj = lines[index];
  if (lineObj === undefined) return null;

  const { text: line, originalIndex } = lineObj;
  const isMatch = checkLineMatch(line);
  
  let content: React.ReactNode;

  if (!highlightRegex) {
    content = <div className={cn(!isMatch && "opacity-30")}>{line}</div>;
  } else {
    const parts = line.split(highlightRegex);

    content = (
      <div className={cn("transition-opacity duration-200", !isMatch && "opacity-30")}>
        {parts.map((part, i) => {
          if (!part) return null;
          
          const lowerPart = part.toLowerCase();
          const kw = sortedKeywords.find(k => k.text.toLowerCase() === lowerPart);
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

          const sh = SYSTEM_HIGHLIGHTS_COMPILED.find(s => s.regex.test(part));
          if (sh) {
            return (
              <span key={i} className={sh.color}>
                {part}
              </span>
            );
          }

          return part;
        })}
      </div>
    );
  }

  return (
    <div 
      style={style} 
      className={cn(
        "flex border-b border-transparent transition-colors group",
        isMatch && keywords.length > 0 && "bg-blue-500/5 dark:bg-blue-400/5",
        "hover:bg-blue-500/10 dark:hover:bg-blue-400/10"
      )}
    >
      <div className={cn(
        "w-14 flex-shrink-0 text-right pr-3 text-[10px] font-mono select-none border-r pt-1.5 transition-colors",
        isMatch && keywords.length > 0 ? "text-blue-500 dark:text-blue-400 border-blue-100 dark:border-blue-900/30" : "text-gray-400 dark:text-gray-600 border-gray-100 dark:border-gray-800",
        "group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:border-blue-100 dark:group-hover:border-blue-900/30"
      )}>
        {originalIndex + 1}
      </div>
      <div className={cn(
        "px-6 flex-grow pt-1",
        wrapLines ? "whitespace-pre-wrap break-all" : "whitespace-pre overflow-hidden text-ellipsis"
      )}>
        {content}
      </div>
    </div>
  );
});

const COLORS = [
  'bg-amber-200 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  'bg-blue-200 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200',
  'bg-emerald-200 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200',
  'bg-rose-200 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200',
  'bg-purple-200 text-purple-900 dark:bg-purple-900/40 dark:text-purple-200',
  'bg-indigo-200 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-200',
  'bg-cyan-200 text-cyan-900 dark:bg-cyan-900/40 dark:text-cyan-200',
];

export default function App() {
  const [fileContent, setFileContent] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [keywordsInput, setKeywordsInput] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFilterView, setIsFilterView] = useState(false);
  const [isFullWidth, setIsFullWidth] = useState(false);
  const [wrapLines, setWrapLines] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('searchHistory');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [suggestionPrefix, setSuggestionPrefix] = useState<string>('');
  const [goToLineInput, setGoToLineInput] = useState<string>('');
  const [cursorPos, setCursorPos] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<List>(null);

  React.useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  React.useEffect(() => {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
  }, [searchHistory]);

  // Save to history after a delay
  React.useEffect(() => {
    if (!keywordsInput.trim()) return;
    
    const timer = setTimeout(() => {
      setSearchHistory(prev => {
        const trimmed = keywordsInput.trim();
        if (prev[0] === trimmed) return prev; // Already the most recent
        const filtered = prev.filter(h => h !== trimmed);
        return [trimmed, ...filtered].slice(0, 10); // Keep last 10
      });
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [keywordsInput]);

  const deferredKeywordsInput = useDeferredValue(keywordsInput);

  const fileWords = useMemo(() => {
    if (!fileContent) return [];
    // Extract unique words of length 3-20, alphanumeric + underscore/dash
    const words = fileContent.match(/\b[a-zA-Z0-9_-]{3,20}\b/g) || [];
    const uniqueWords = Array.from(new Set(words));
    // Limit to top 500 words to keep it snappy
    return uniqueWords.slice(0, 500);
  }, [fileContent]);

  const suggestions = useMemo(() => {
    if (!suggestionPrefix || suggestionPrefix.length < 2) return [];
    
    const prefix = suggestionPrefix.toLowerCase().replace(/^[+-]/, '');
    const operator = suggestionPrefix.startsWith('+') ? '+' : suggestionPrefix.startsWith('-') ? '-' : '';
    
    const historyWords = searchHistory.flatMap(h => h.split(/[,|\n]/).map(w => w.trim().replace(/^[+-]/, '')));
    const allPotential = Array.from(new Set([...historyWords, ...fileWords]));
    
    return allPotential
      .filter(w => w.toLowerCase().startsWith(prefix) && w.toLowerCase() !== prefix)
      .slice(0, 8)
      .map(w => operator + w);
  }, [suggestionPrefix, fileWords, searchHistory]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart;
    setKeywordsInput(value);
    setCursorPos(pos);

    // Find the word at cursor
    const beforeCursor = value.substring(0, pos);
    const match = beforeCursor.match(/[^\s,|\n]+$/);
    if (match) {
      setSuggestionPrefix(match[0]);
    } else {
      setSuggestionPrefix('');
    }
  };

  const applySuggestion = (suggestion: string) => {
    const before = keywordsInput.substring(0, cursorPos - suggestionPrefix.length);
    const after = keywordsInput.substring(cursorPos);
    const newValue = before + suggestion + after;
    setKeywordsInput(newValue);
    setSuggestionPrefix('');
    
    // Refocus and set cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = before.length + suggestion.length;
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const keywords = useMemo<Keyword[]>(() => {
    return deferredKeywordsInput
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
  }, [deferredKeywordsInput]);

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

    const keywordRegexes = keywords.map(kw => ({
      kw,
      regex: new RegExp(kw.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    }));

    return keywordRegexes.map(({ kw, regex }) => {
      const matches = fileContent.match(regex);
      return {
        keyword: kw.text,
        operator: kw.operator,
        count: matches ? matches.length : 0,
        color: kw.color
      };
    });
  }, [fileContent, keywords]);

  const filterConfig = useMemo(() => {
    const required = keywords.filter(k => k.operator === 'required').map(k => k.text.toLowerCase());
    const excluded = keywords.filter(k => k.operator === 'excluded').map(k => k.text.toLowerCase());
    const optional = keywords.filter(k => k.operator === 'optional').map(k => k.text.toLowerCase());

    const levelRegexes = selectedLevels.map(level => new RegExp(`\\b${level}\\b`, 'i'));
    const typeRegexes = selectedTypes.map(type => {
      const highlights = SYSTEM_HIGHLIGHTS_COMPILED.filter(s => s.type === type);
      return highlights.map(h => h.searchRegex);
    }).flat();

    const timestampRegex = SYSTEM_HIGHLIGHTS_COMPILED.find(s => s.type === 'timestamp')?.searchRegex;

    return {
      required,
      excluded,
      optional,
      levelRegexes,
      typeRegexes,
      timestampRegex,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };
  }, [keywords, selectedLevels, selectedTypes, startDate, endDate]);

  const checkLineMatch = useCallback((line: string) => {
    const { 
      required, excluded, optional, 
      levelRegexes, typeRegexes, 
      timestampRegex, startDate, endDate 
    } = filterConfig;

    if (keywords.length === 0 && levelRegexes.length === 0 && typeRegexes.length === 0 && !startDate && !endDate) {
      return true;
    }

    const lowerLine = line.toLowerCase();

    // Must NOT contain any excluded
    if (excluded.some(k => lowerLine.includes(k))) return false;

    // Must contain ALL required
    if (required.length > 0) {
      if (!required.every(k => lowerLine.includes(k))) return false;
    }

    // If no required, must contain at least one optional (if any optional exist)
    if (required.length === 0 && optional.length > 0) {
      if (!optional.some(k => lowerLine.includes(k))) return false;
    }

    // Advanced Filters
    if (levelRegexes.length > 0) {
      if (!levelRegexes.some(regex => regex.test(line))) return false;
    }

    if (typeRegexes.length > 0) {
      if (!typeRegexes.some(regex => regex.test(line))) return false;
    }

    if (startDate || endDate) {
      if (timestampRegex) {
        const match = line.match(timestampRegex);
        if (match) {
          try {
            const logDate = new Date(match[0]);
            if (startDate && logDate < startDate) return false;
            if (endDate && logDate > endDate) return false;
          } catch (e) {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    return true;
  }, [keywords.length, filterConfig]);

  const highlightData = useMemo(() => {
    const activeKeywords = keywords.filter(k => k.operator !== 'excluded');
    
    const userPatterns = activeKeywords
      .map(k => k.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    
    const systemPatterns = SYSTEM_HIGHLIGHTS.map(s => s.pattern);
    
    const allPatterns = [...userPatterns, ...systemPatterns];
    if (allPatterns.length === 0) return { regex: null, sorted: [] };

    const pattern = `(${allPatterns.join('|')})`;
    
    return {
      regex: new RegExp(pattern, 'gi'),
      sorted: [...activeKeywords].sort((a, b) => b.text.length - a.text.length)
    };
  }, [keywords]);

  const lines = useMemo<LineObject[]>(() => {
    if (!fileContent) return [];
    return fileContent.split(/\r?\n/).map((text, originalIndex) => ({
      text,
      originalIndex
    }));
  }, [fileContent]);

  const highlightedContent = useMemo(() => {
    if (lines.length === 0) return [];
    if (!isFilterView) return lines;
    return lines.filter(lineObj => checkLineMatch(lineObj.text));
  }, [lines, isFilterView, checkLineMatch]);

  const itemData = useMemo<RowData>(() => ({
    lines: highlightedContent,
    keywords,
    checkLineMatch,
    highlightRegex: highlightData.regex,
    sortedKeywords: highlightData.sorted,
    wrapLines
  }), [highlightedContent, keywords, checkLineMatch, highlightData, wrapLines]);

  const downloadFiltered = () => {
    if (lines.length === 0) return;

    const filteredLines = lines
      .filter(lineObj => checkLineMatch(lineObj.text))
      .map(lineObj => lineObj.text);

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

  const matchDensity = useMemo(() => {
    if (lines.length === 0 || keywords.length === 0) return [];
    
    const numChunks = 100;
    const chunkSize = Math.ceil(lines.length / numChunks);
    const density = new Array(numChunks).fill(0);
    
    lines.forEach((lineObj, i) => {
      if (checkLineMatch(lineObj.text)) {
        const chunkIndex = Math.floor(i / chunkSize);
        if (chunkIndex < numChunks) {
          density[chunkIndex]++;
        }
      }
    });
    
    const max = Math.max(...density);
    return density.map(v => (max === 0 ? 0 : v / max));
  }, [lines, keywords, checkLineMatch]);

  const scrollToChunk = (chunkIndex: number) => {
    if (!listRef.current || lines.length === 0) return;
    const targetOriginalIndex = Math.floor((chunkIndex / 100) * lines.length);
    
    if (isFilterView) {
      const highlightedIndex = highlightedContent.findIndex(l => l.originalIndex >= targetOriginalIndex);
      if (highlightedIndex !== -1) {
        listRef.current.scrollToItem(highlightedIndex, 'start');
      }
    } else {
      listRef.current.scrollToItem(targetOriginalIndex, 'start');
    }
  };

  const handleGoToLine = useCallback(() => {
    const lineNum = parseInt(goToLineInput, 10);
    if (isNaN(lineNum) || lineNum < 1 || !listRef.current) return;
    
    const targetOriginalIndex = lineNum - 1;
    
    if (isFilterView) {
      const highlightedIndex = highlightedContent.findIndex(l => l.originalIndex >= targetOriginalIndex);
      if (highlightedIndex !== -1) {
        listRef.current.scrollToItem(highlightedIndex, 'start');
      }
    } else {
      listRef.current.scrollToItem(Math.min(targetOriginalIndex, lines.length - 1), 'start');
    }
  }, [goToLineInput, isFilterView, highlightedContent, lines.length]);

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-blue-100 transition-colors duration-300",
      isDarkMode ? "bg-[#0F1115] text-[#E2E2E2] dark" : "bg-[#F8F9FA] text-[#1A1C1E]"
    )}>
      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-10 transition-colors duration-300",
        isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className={cn(
          "mx-auto px-4 h-16 flex items-center justify-between transition-all duration-300",
          isFullWidth ? "max-w-full" : "max-w-7xl"
        )}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-sm">
              <Filter size={18} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">Log File Parser</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isDarkMode ? "bg-gray-800 text-yellow-400 hover:bg-gray-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {fileContent && (
              <>
                <div className={cn(
                  "flex items-center p-1 rounded-lg mr-2",
                  isDarkMode ? "bg-gray-800" : "bg-gray-100"
                )}>
                  <button
                    onClick={() => setIsFilterView(false)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      !isFilterView 
                        ? (isDarkMode ? "bg-gray-700 shadow-sm text-blue-400" : "bg-white shadow-sm text-blue-600") 
                        : (isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                    )}
                  >
                    Full View
                  </button>
                  <button
                    onClick={() => setIsFilterView(true)}
                    className={cn(
                      "px-3 py-1 text-xs font-medium rounded-md transition-all",
                      isFilterView 
                        ? (isDarkMode ? "bg-gray-700 shadow-sm text-blue-400" : "bg-white shadow-sm text-blue-600") 
                        : (isDarkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700")
                    )}
                  >
                    Matches Only
                  </button>
                </div>
                <button
                  onClick={downloadFiltered}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    isDarkMode ? "text-blue-400 hover:bg-blue-900/30" : "text-blue-600 hover:bg-blue-50"
                  )}
                >
                  <Download size={16} />
                  <span>Export Matches</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={cn(
        "mx-auto p-4 md:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 transition-all duration-300",
        isFullWidth ? "max-w-full" : "max-w-7xl"
      )}>
        {/* Left Column: Controls */}
        {!isFullWidth && (
          <div className="lg:col-span-4 space-y-6">
          {/* Upload Section */}
          <section className={cn(
            "rounded-2xl border p-5 shadow-sm transition-colors duration-300",
            isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-white border-gray-200"
          )}>
            <h2 className={cn(
              "text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2",
              isDarkMode ? "text-gray-400" : "text-gray-500"
            )}>
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
                  : (isDarkMode ? "border-gray-700 hover:border-gray-600 hover:bg-gray-800/50" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50")
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
                  isDragging 
                    ? "bg-blue-100 text-blue-600" 
                    : (isDarkMode ? "bg-gray-800 text-gray-500 group-hover:bg-gray-700" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200")
                )}>
                  <FileText size={24} />
                </div>
                {fileName ? (
                  <div className="space-y-1">
                    <p className={cn(
                      "text-sm font-medium truncate max-w-[200px]",
                      isDarkMode ? "text-gray-200" : "text-gray-900"
                    )}>{fileName}</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <>
                    <p className={cn(
                      "text-sm font-medium",
                      isDarkMode ? "text-gray-300" : "text-gray-900"
                    )}>Click or drag file</p>
                    <p className="text-xs text-gray-500 mt-1">TXT, LOG, CSV, JSON (max 50MB)</p>
                  </>
                )}
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "mt-3 p-3 border rounded-lg flex items-start gap-2 text-xs",
                  isDarkMode ? "bg-red-900/20 border-red-900/50 text-red-400" : "bg-red-50 border-red-100 text-red-600"
                )}
              >
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <p>{error}</p>
              </motion.div>
            )}
          </section>

          {/* Keywords Section */}
          <section className={cn(
            "rounded-2xl border p-5 shadow-sm transition-colors duration-300",
            isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(
                "text-sm font-semibold uppercase tracking-wider flex items-center gap-2",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )}>
                <Search size={14} />
                Keywords
              </h2>
              <div className="group relative">
                <AlertCircle size={14} className="text-gray-400 cursor-help" />
                <div className={cn(
                  "absolute right-0 top-6 w-48 p-3 text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 shadow-xl leading-relaxed",
                  isDarkMode ? "bg-gray-800 text-gray-200 border border-gray-700" : "bg-gray-900 text-white"
                )}>
                  <p className="font-bold mb-1">Search Operators:</p>
                  <p><span className="text-blue-400 font-mono">+term</span>: Must be present (AND)</p>
                  <p><span className="text-red-400 font-mono">-term</span>: Must NOT be present (NOT)</p>
                  <p><span className={isDarkMode ? "text-gray-400 font-mono" : "text-gray-400 font-mono"}>term</span>: Optional (OR)</p>
                </div>
              </div>
            </div>
            <div className="space-y-3 relative">
              <textarea
                ref={textareaRef}
                value={keywordsInput}
                onChange={handleTextareaChange}
                onKeyUp={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
                onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
                placeholder="Use + for required, - for excluded..."
                className={cn(
                  "w-full h-32 p-3 text-sm border rounded-xl outline-none resize-none transition-all",
                  isDarkMode 
                    ? "bg-[#0F1115] border-gray-800 text-gray-200 focus:ring-2 focus:ring-blue-900 placeholder:text-gray-600" 
                    : "bg-white border-gray-200 text-gray-900 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                )}
              />

              {/* Suggestions Dropdown */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "absolute left-0 right-0 top-32 mt-1 z-30 rounded-xl border shadow-2xl overflow-hidden",
                      isDarkMode ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
                    )}
                  >
                    <div className={cn(
                      "px-3 py-2 text-[10px] font-bold uppercase tracking-widest border-b",
                      isDarkMode ? "bg-gray-900/50 border-gray-700 text-gray-500" : "bg-gray-50 border-gray-100 text-gray-400"
                    )}>
                      Suggestions
                    </div>
                    <div className="max-h-48 overflow-y-auto p-1">
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          onClick={() => applySuggestion(suggestion)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between group",
                            isDarkMode ? "hover:bg-gray-700 text-gray-300" : "hover:bg-blue-50 text-gray-700"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <CheckSquare size={12} className="opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                            {suggestion}
                          </span>
                          <span className={cn(
                            "text-[10px] opacity-0 group-hover:opacity-50",
                            isDarkMode ? "text-gray-400" : "text-gray-500"
                          )}>
                            Click to add
                          </span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

              {/* Recent Searches */}
              {searchHistory.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={cn(
                      "text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5",
                      isDarkMode ? "text-gray-500" : "text-gray-400"
                    )}>
                      <Clock size={10} />
                      Recent Searches
                    </h3>
                    <button 
                      onClick={() => setSearchHistory([])}
                      className={cn(
                        "p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors",
                        isDarkMode ? "hover:text-red-300" : "hover:text-red-500"
                      )}
                      title="Clear history"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1">
                    {searchHistory.map((historyItem, idx) => (
                      <button
                        key={idx}
                        onClick={() => setKeywordsInput(historyItem)}
                        className={cn(
                          "text-left px-2 py-1.5 rounded text-xs truncate transition-colors",
                          isDarkMode 
                            ? "text-gray-400 hover:bg-gray-800 hover:text-gray-200" 
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        )}
                      >
                        {historyItem}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Advanced Filters Section */}
          <section className={cn(
            "rounded-2xl border p-5 shadow-sm transition-colors duration-300",
            isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={cn(
                "text-sm font-semibold uppercase tracking-wider flex items-center gap-2",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )}>
                <Activity size={14} />
                Advanced Filters
              </h2>
              {(selectedLevels.length > 0 || selectedTypes.length > 0 || startDate || endDate) && (
                <button 
                  onClick={() => {
                    setSelectedLevels([]);
                    setSelectedTypes([]);
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-tighter"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="space-y-5">
              {/* Log Levels */}
              <div>
                <label className={cn(
                  "text-[10px] font-bold uppercase tracking-widest mb-2 block",
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                )}>
                  Log Levels
                </label>
                <div className="flex flex-wrap gap-2">
                  {['ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => (
                    <button
                      key={level}
                      onClick={() => setSelectedLevels(prev => 
                        prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
                      )}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold transition-all border",
                        selectedLevels.includes(level)
                          ? (isDarkMode ? "bg-blue-900/40 border-blue-800 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600")
                          : (isDarkMode ? "bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-600" : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200")
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* System Types */}
              <div>
                <label className={cn(
                  "text-[10px] font-bold uppercase tracking-widest mb-2 block",
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                )}>
                  Pattern Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'timestamp', label: 'Time', icon: Clock },
                    { id: 'id', label: 'UUIDs', icon: Hash },
                    { id: 'network', label: 'IPs', icon: Activity }
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedTypes(prev => 
                        prev.includes(type.id) ? prev.filter(t => t !== type.id) : [...prev, type.id]
                      )}
                      className={cn(
                        "px-2 py-1 rounded-md text-[10px] font-bold transition-all border flex items-center gap-1.5",
                        selectedTypes.includes(type.id)
                          ? (isDarkMode ? "bg-purple-900/40 border-purple-800 text-purple-400" : "bg-purple-50 border-purple-200 text-purple-600")
                          : (isDarkMode ? "bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-600" : "bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200")
                      )}
                    >
                      <type.icon size={10} />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className={cn(
                  "text-[10px] font-bold uppercase tracking-widest mb-2 block",
                  isDarkMode ? "text-gray-500" : "text-gray-400"
                )}>
                  Date Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Calendar size={10} className="absolute left-2 top-2.5 text-gray-500" />
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={cn(
                        "w-full pl-7 pr-2 py-1.5 text-[10px] rounded-lg border outline-none transition-all",
                        isDarkMode 
                          ? "bg-[#0F1115] border-gray-800 text-gray-300 focus:ring-1 focus:ring-blue-900" 
                          : "bg-white border-gray-200 text-gray-700 focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                  <div className="relative">
                    <Calendar size={10} className="absolute left-2 top-2.5 text-gray-500" />
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={cn(
                        "w-full pl-7 pr-2 py-1.5 text-[10px] rounded-lg border outline-none transition-all",
                        isDarkMode 
                          ? "bg-[#0F1115] border-gray-800 text-gray-300 focus:ring-1 focus:ring-blue-900" 
                          : "bg-white border-gray-200 text-gray-700 focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                </div>
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
                className={cn(
                  "rounded-2xl border p-5 shadow-sm transition-colors duration-300",
                  isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-white border-gray-200"
                )}
              >
                <h2 className={cn(
                  "text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  <Hash size={14} />
                  Occurrences
                </h2>
                <div className="space-y-2">
                  {stats.map((stat, i) => (
                    <div key={i} className={cn(
                      "flex items-center justify-between p-2 rounded-lg transition-colors",
                      isDarkMode ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", stat.color.split(' ')[0])} />
                        <span className={cn(
                          "text-sm font-medium",
                          isDarkMode ? "text-gray-300" : "text-gray-700"
                        )}>
                          {stat.keyword}
                          {stat.operator !== 'optional' && (
                            <span className={cn(
                              "ml-1.5 text-[10px] uppercase tracking-tighter px-1 rounded",
                              stat.operator === 'required' 
                                ? (isDarkMode ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-600") 
                                : (isDarkMode ? "bg-red-900/40 text-red-400" : "bg-red-100 text-red-600")
                            )}>
                              {stat.operator === 'required' ? 'AND' : 'NOT'}
                            </span>
                          )}
                        </span>
                      </div>
                      <span className={cn(
                        "text-sm font-mono font-bold",
                        isDarkMode ? "text-gray-100" : "text-gray-900"
                      )}>{stat.count}</span>
                    </div>
                  ))}
                </div>

                {/* Visualization */}
                <div className="mt-6 h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? "#374151" : "#E5E7EB"} />
                      <XAxis 
                        dataKey="keyword" 
                        hide 
                      />
                      <YAxis 
                        tick={{ fontSize: 10, fill: isDarkMode ? "#9CA3AF" : "#6B7280" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: isDarkMode ? "#1F2937" : "#FFFFFF",
                          borderColor: isDarkMode ? "#374151" : "#E5E7EB",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: isDarkMode ? "#F3F4F6" : "#111827"
                        }}
                        itemStyle={{ color: isDarkMode ? "#F3F4F6" : "#111827" }}
                        cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {stats.map((entry, index) => {
                          // Extract hex or tailwind color if possible, or use a default
                          // Since stat.color is a tailwind class string like "bg-amber-200 text-amber-900..."
                          // we'll map common tailwind colors to hex for Recharts
                          const colorMap: Record<string, string> = {
                            'amber': '#F59E0B',
                            'blue': '#3B82F6',
                            'emerald': '#10B981',
                            'rose': '#F43F5E',
                            'purple': '#8B5CF6',
                            'indigo': '#6366F1',
                            'cyan': '#06B6D4'
                          };
                          const colorKey = Object.keys(colorMap).find(key => entry.color.includes(key)) || 'blue';
                          return <Cell key={`cell-${index}`} fill={colorMap[colorKey]} fillOpacity={0.8} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>
        )}

        {/* Right Column: Content Viewer */}
        <div className={cn(
          "transition-all duration-300",
          isFullWidth ? "lg:col-span-12" : "lg:col-span-8"
        )}>
          <section className={cn(
            "rounded-2xl border shadow-sm h-full flex flex-col overflow-hidden min-h-[600px] transition-colors duration-300",
            isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-white border-gray-200"
          )}>
            <div className={cn(
              "px-5 py-4 border-b flex items-center justify-between transition-colors duration-300",
              isDarkMode ? "bg-[#1A1D23] border-gray-800" : "bg-gray-50/50 border-gray-100"
            )}>
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-gray-400" />
                <span className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                )}>
                  {fileName || 'No file selected'}
                </span>
                {isFilterView && (
                  <span className={cn(
                    "px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider",
                    isDarkMode ? "bg-blue-900/40 text-blue-400" : "bg-blue-100 text-blue-600"
                  )}>
                    Filtering Active
                  </span>
                )}
              </div>
              {fileContent && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 border-r pr-4 border-gray-200 dark:border-gray-800">
                    <div className={cn(
                      "flex items-center rounded-lg px-2 py-1 gap-1 transition-colors",
                      isDarkMode ? "bg-gray-800/50" : "bg-gray-100"
                    )}>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Go to:</span>
                      <input
                        type="number"
                        value={goToLineInput}
                        onChange={(e) => setGoToLineInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGoToLine()}
                        placeholder="Line #"
                        className="w-14 bg-transparent border-none text-[10px] font-mono focus:ring-0 p-0 text-blue-500 placeholder:text-gray-500"
                      />
                      <button
                        onClick={handleGoToLine}
                        className="text-gray-400 hover:text-blue-500 transition-colors"
                        title="Go to line"
                      >
                        <ArrowRight size={12} />
                      </button>
                    </div>
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-800 mx-1" />
                    <button
                      onClick={() => setWrapLines(!wrapLines)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                        wrapLines 
                          ? "bg-blue-500/10 text-blue-500" 
                          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      title="Toggle Wrap Lines"
                    >
                      <WrapText size={14} />
                      {wrapLines ? "Wrapped" : "Compact"}
                    </button>
                    <button
                      onClick={() => setIsFullWidth(!isFullWidth)}
                      className={cn(
                        "p-1.5 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider",
                        isFullWidth 
                          ? "bg-blue-500/10 text-blue-500" 
                          : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                      title="Toggle Full Width"
                    >
                      {isFullWidth ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      {isFullWidth ? "Shrink" : "Expand"}
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 font-mono">
                    {fileContent.length.toLocaleString()} characters
                  </div>
                </div>
              )}
            </div>
            
            <div className={cn(
              "flex-1 font-mono text-sm leading-relaxed transition-colors duration-300 relative flex",
              isDarkMode ? "bg-[#0F1115] text-gray-300" : "bg-white text-gray-900"
            )}>
              {!fileContent ? (
                <div className="h-full flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4 py-20">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center border transition-colors duration-300",
                    isDarkMode ? "bg-gray-800/20 border-gray-800" : "bg-gray-50 border-gray-100"
                  )}>
                    <Upload size={32} className="opacity-20" />
                  </div>
                  <div className="text-center">
                    <p className={cn(
                      "text-base font-medium",
                      isDarkMode ? "text-gray-500" : "text-gray-500"
                    )}>Viewer is empty</p>
                    <p className="text-sm">Upload a file to start parsing keywords</p>
                  </div>
                </div>
              ) : highlightedContent.length === 0 ? (
                <div className="h-full flex-1 flex flex-col items-center justify-center text-gray-400 space-y-4 py-20">
                  <div className={cn(
                    "w-16 h-16 rounded-full flex items-center justify-center border transition-colors duration-300",
                    isDarkMode ? "bg-gray-800/20 border-gray-800" : "bg-gray-50 border-gray-100"
                  )}>
                    <Search size={32} className="opacity-20" />
                  </div>
                  <div className="text-center px-4">
                    <p className={cn(
                      "text-base font-medium",
                      isDarkMode ? "text-gray-500" : "text-gray-500"
                    )}>No matches found</p>
                    <p className="text-sm">Try adjusting your keywords or filters to see results</p>
                    {isFilterView && (
                      <button 
                        onClick={() => setIsFilterView(false)}
                        className="mt-4 text-blue-500 hover:underline text-xs font-bold uppercase tracking-widest"
                      >
                        Switch to Full View
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 relative">
                    <AutoSizer>
                      {({ height, width }) => (
                        <List
                          ref={listRef}
                          height={height}
                          itemCount={highlightedContent.length}
                          itemSize={wrapLines ? 64 : 24}
                          width={width}
                          itemData={itemData}
                          overscanCount={10}
                          className="scrollbar-thin scrollbar-thumb-gray-500/50 scrollbar-track-transparent"
                        >
                          {Row}
                        </List>
                      )}
                    </AutoSizer>
                  </div>
                  
                  {/* Heatmap Strip */}
                  {matchDensity.length > 0 && (
                    <div className={cn(
                      "w-4 h-full border-l flex flex-col transition-colors",
                      isDarkMode ? "bg-[#16191E] border-gray-800" : "bg-gray-50 border-gray-100"
                    )}>
                      {matchDensity.map((density, i) => (
                        <div
                          key={i}
                          onClick={() => scrollToChunk(i)}
                          className="flex-1 cursor-pointer hover:opacity-80 transition-opacity relative group"
                          style={{
                            backgroundColor: density > 0 
                              ? `rgba(59, 130, 246, ${0.1 + density * 0.9})` 
                              : 'transparent'
                          }}
                        >
                          {density > 0 && (
                            <div className={cn(
                              "absolute right-full mr-2 px-2 py-1 rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 shadow-xl transition-opacity",
                              isDarkMode ? "bg-gray-800 text-gray-200 border border-gray-700" : "bg-gray-900 text-white"
                            )}>
                              {Math.round(density * 100)}% density at {Math.round((i / 100) * 100)}% of file
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className={cn(
        "mx-auto px-4 py-8 text-center text-gray-400 text-xs transition-all duration-300",
        isFullWidth ? "max-w-full" : "max-w-7xl"
      )}>
        <p>&copy; 2026 Log File Parser &bull; Built with precision</p>
      </footer>
    </div>
  );
}
