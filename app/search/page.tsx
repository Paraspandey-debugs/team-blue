'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function Search() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [caseName, setCaseName] = useState('default-case');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [question, setQuestion] = useState('');
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaLoading, setQaLoading] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelingDocId, setLabelingDocId] = useState<string>('');
  const [currentLabels, setCurrentLabels] = useState<string[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('');
  const [relevanceThreshold, setRelevanceThreshold] = useState(0.1);
  const [queryType, setQueryType] = useState<'search' | 'question'>('search');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [pageSize] = useState(10);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const extractCaseFromQuestion = (question: string): string | null => {
    // Look for patterns like "case 123", "case ABC-456", "case no 789", etc.
    const casePatterns = [
      /case\s+(?:no\.?\s*)?([A-Za-z0-9\-]+)/i,
      /in\s+case\s+([A-Za-z0-9\-]+)/i,
      /for\s+case\s+([A-Za-z0-9\-]+)/i,
      /about\s+case\s+([A-Za-z0-9\-]+)/i
    ];

    for (const pattern of casePatterns) {
      const match = question.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  const loadAvailableLabels = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) return;

      const response = await fetch('/api/documents/labels', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableLabels(data.labels || []);
      }
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const handleLabelDocument = (docId: string, currentLabels: string[]) => {
    setLabelingDocId(docId);
    setCurrentLabels([...currentLabels]);
    setShowLabelModal(true);
  };

  const saveLabels = async (newLabels: string[]) => {
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) return;

      const response = await fetch('/api/documents/labels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          docId: labelingDocId,
          labels: newLabels,
          action: 'set'
        }),
      });

      if (response.ok) {
        // Update the document in search results
        setSearchResults(prev => prev.map(doc =>
          doc.docId === labelingDocId
            ? { ...doc, labels: newLabels }
            : doc
        ));
        setShowLabelModal(false);
        loadAvailableLabels(); // Refresh available labels
      } else {
        console.error('Failed to save labels');
      }
    } catch (error) {
      console.error('Failed to save labels:', error);
    }
  };

  const performSearch = async (searchQuery: string, searchCaseName: string = caseName, page: number = 1) => {
    setIsLoading(true);
    setAiAnswer('');
    setSearchResults([]);
    setCurrentPage(page);
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          query: searchQuery, 
          caseName: searchCaseName,
          page,
          pageSize,
          filters: {
            minRelevanceScore: relevanceThreshold,
            uploadedAfter: dateFilter || undefined
          }
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setSearchResults(data.documents || []);
      setTotalResults(data.totalResults || 0);
      setAiAnswer(`Found ${data.totalResults} relevant documents for "${searchQuery}"`);
    } catch (error: any) {
      console.error('Search error:', error);
      setAiAnswer(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
      setTotalResults(0);
    } finally {
      setIsLoading(false);
    }
  };

  const performQA = async (userQuestion: string, searchCaseName: string = caseName) => {
    setQaLoading(true);
    setQaAnswer('');
    try {
      const token = localStorage.getItem('jwt_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch('/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ question: userQuestion, collectionName: searchCaseName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'QA failed');
      }

      const data = await response.json();
      setQaAnswer(data.answer || 'No answer available');
    } catch (error: any) {
      console.error('QA error:', error);
      setQaAnswer(error.message || 'Question answering failed. Please try again.');
    } finally {
      setQaLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-72 h-72 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-bounce dark:bg-blue-900 dark:opacity-20"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-bounce animation-delay-1000 dark:bg-purple-900 dark:opacity-20"></div>
        <div className="absolute bottom-10 left-1/2 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-bounce animation-delay-2000 dark:bg-pink-900 dark:opacity-20"></div>
      </div>

      <div className="relative">
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-md shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 dark:focus:ring-offset-gray-900"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Dashboard
                </button>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center dark:bg-blue-500">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Search</h1>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {searchResults.length} results found
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8 space-y-12">
        {/* Search Bar */}
        <div className="mb-16">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl shadow-blue-500/5 p-10 relative overflow-hidden">
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/30 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-100/20 to-transparent rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative space-y-10">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Search Your Documents</h2>
                  <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">Ask questions in natural language to find relevant information across all your legal documents</p>
                </div>

                <div className="space-y-8">
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="case-name" className="block text-sm font-semibold text-gray-900 mb-4 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        Case Name
                      </label>
                      <input
                        id="case-name"
                        type="text"
                        value={caseName}
                        onChange={(e) => setCaseName(e.target.value)}
                        placeholder="Enter case name (e.g., smith-vs-jones)"
                        className="block w-full px-5 py-4 border border-gray-300 rounded-2xl bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition-all duration-300 hover:shadow-md"
                      />
                    </div>

                    <div className="relative">
                      <div className="relative bg-gradient-to-br from-gray-50 to-white rounded-3xl border-2 border-gray-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all duration-300 shadow-lg hover:shadow-xl">
                        <textarea
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onFocus={() => setShowSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && performSearch(query, caseName)}
                          placeholder="Ask me anything about your legal documents... e.g., 'What are the key terms in the NDA?' or 'Summarize the contract obligations'"
                          className="w-full px-8 py-6 bg-transparent border-none rounded-3xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 resize-none min-h-[80px] text-lg leading-relaxed"
                          rows={1}
                          style={{ minHeight: '80px' }}
                          onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                          }}
                        />
                        <button
                          onClick={() => performSearch(query, caseName)}
                          disabled={isLoading || !query.trim()}
                          className="absolute right-6 bottom-6 w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          {isLoading ? (
                            <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          )}
                        </button>
                      </div>
                    
                    {/* Query Suggestions */}
                    {showSuggestions && !query.trim() && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-lg z-10 p-4">
                        <div className="text-sm text-gray-600 mb-3 font-medium">💡 Try these example queries:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {[
                            "What are the payment terms in the contract?",
                            "Summarize the confidentiality obligations",
                            "What is the termination clause?",
                            "Who are the parties involved?",
                            "What are the key deadlines?",
                            "Explain the liability provisions",
                            "What happens in case of breach?",
                            "What are the governing law requirements?"
                          ].map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setQuery(suggestion);
                                setShowSuggestions(false);
                              }}
                              className="text-left p-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors duration-200 border border-transparent hover:border-blue-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs text-gray-500">
                            <strong>Pro tips:</strong> Use natural language • Be specific • Ask follow-up questions
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 text-center">
                      <p className="text-sm text-gray-500">
                        Press Enter to search • Use natural language queries for best results
                      </p>
                    </div>
                  </div>

                  {/* Advanced Filters */}
                  <div className="mt-4">
                    <button
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                      className="flex items-center justify-center w-full py-2 px-4 text-sm text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200 border border-gray-200"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
                      <svg className={`w-4 h-4 ml-2 transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showAdvancedFilters && (
                      <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Minimum Relevance Score
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="range"
                                min="0.1"
                                max="0.9"
                                step="0.1"
                                value={relevanceThreshold}
                                onChange={(e) => setRelevanceThreshold(parseFloat(e.target.value))}
                                className="flex-1"
                              />
                              <span className="text-sm text-gray-600 min-w-[3rem]">
                                {(relevanceThreshold * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Uploaded After
                            </label>
                            <input
                              type="date"
                              value={dateFilter}
                              onChange={(e) => setDateFilter(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={() => {
                              setDateFilter('');
                              setRelevanceThreshold(0.1);
                            }}
                            className="text-sm text-gray-600 hover:text-gray-800 underline"
                          >
                            Reset filters
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* Question Answering Section */}
        <div className="mb-16">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl shadow-green-500/5 p-10 relative overflow-hidden">
              {/* Decorative gradient */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-green-100/30 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-emerald-100/20 to-transparent rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative space-y-8">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl mb-6 shadow-lg">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">Ask Questions</h2>
                  <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">Get direct answers to your questions based on your documents</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="question-input" className="block text-sm font-semibold text-gray-900 mb-4 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Your Question
                    </label>
                    <div className="relative">
                      <textarea
                        id="question-input"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onFocus={() => setQueryType('question')}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            const extractedCase = extractCaseFromQuestion(question);
                            const caseToUse = extractedCase || caseName;
                            performQA(question, caseToUse);
                          }
                        }}
                        placeholder="Ask me anything about your legal documents... e.g., 'What is the termination clause?' or 'In case 123, what are the payment terms?'"
                        className="w-full px-6 py-5 border-2 border-gray-200 rounded-3xl bg-white placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-400 text-gray-900 text-lg leading-relaxed shadow-lg hover:shadow-xl transition-all duration-300 resize-none min-h-[100px]"
                        rows={3}
                        style={{ minHeight: '100px' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                        }}
                      />
                      <button
                        onClick={() => {
                          const extractedCase = extractCaseFromQuestion(question);
                          const caseToUse = extractedCase || caseName;
                          performQA(question, caseToUse);
                        }}
                        disabled={qaLoading || !question.trim()}
                        className="absolute right-6 bottom-6 w-12 h-12 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed rounded-2xl flex items-center justify-center transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                      >
                        {qaLoading ? (
                          <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    
                    {/* QA Suggestions */}
                    {queryType === 'question' && !question.trim() && (
                      <div className="mt-2 bg-green-50 rounded-lg border border-green-200 p-3">
                        <div className="text-sm text-green-800 mb-2 font-medium">🤔 Question Examples:</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {[
                            "What is the effective date of the agreement?",
                            "Who has the right to terminate this contract?",
                            "What are the confidentiality requirements?",
                            "What happens if one party breaches the contract?",
                            "Are there any non-compete clauses?",
                            "What is the governing law?",
                            "What are the notice requirements?",
                            "How long does this agreement last?",
                            "In case 123, what are the payment terms?",
                            "For case ABC-456, what is the termination clause?",
                            "About case XYZ, summarize the liability provisions"
                          ].map((suggestion, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setQuestion(suggestion);
                                setQueryType('search');
                              }}
                              className="text-left p-2 text-green-700 hover:bg-green-100 rounded-md transition-colors duration-200"
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-3 text-center">
                      <p className="text-sm text-gray-500">
                        Press Enter to ask • Get AI-powered answers from your documents
                      </p>
                    </div>
                  </div>
                  {qaAnswer && (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                      <div className="flex items-start">
                        <svg className="w-6 h-6 mt-0.5 mr-3 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-semibold text-green-900">Answer</h4>
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                              Case: {(() => {
                                const extractedCase = extractCaseFromQuestion(question);
                                return extractedCase || caseName;
                              })()}
                            </span>
                          </div>
                          <p className="text-green-800 leading-relaxed whitespace-pre-wrap">{qaAnswer}</p>
                          
                          {/* Follow-up Suggestions */}
                          <div className="mt-4 pt-4 border-t border-green-200">
                            <div className="text-sm text-green-700 mb-2 font-medium">🔍 Follow-up questions you might ask:</div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                "Can you explain this in more detail?",
                                "What are the specific requirements?",
                                "Are there any exceptions to this?",
                                "How does this compare to standard terms?",
                                "What happens if this isn't followed?",
                                "Can you show me the relevant section?"
                              ].map((followUp, index) => (
                                <button
                                  key={index}
                                  onClick={() => setQuestion(followUp)}
                                  className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 text-xs rounded-lg transition-colors duration-200 border border-green-300"
                                >
                                  {followUp}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* Search Results - Documents */}
            <div className="xl:col-span-3">
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl shadow-blue-500/5 overflow-hidden">
                <div className="p-8 border-b border-gray-200/50 bg-gradient-to-r from-blue-50/80 to-indigo-50/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg mr-4">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900">Search Results</h3>
                        <p className="text-sm text-gray-600 mt-1">Found {searchResults.length} relevant document{searchResults.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="max-h-[700px] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-20 text-center">
                      <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                        <svg className="animate-spin h-10 w-10 text-blue-600" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">Searching your documents...</h3>
                      <p className="text-gray-600">This may take a few seconds for comprehensive results</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="p-8">
                      <div className="space-y-6">
                        {searchResults.map((doc: any, index: number) => (
                          <div
                            key={doc.docId}
                            className="bg-gradient-to-br from-white to-gray-50/50 border border-gray-200/60 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 group overflow-hidden hover:border-blue-200/50"
                          >
                            <div className="p-8">
                              <div className="flex items-start justify-between mb-6">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-4 mb-4">
                                    <h4 className="text-xl font-bold text-gray-900 group-hover:text-blue-700 transition-colors duration-300">
                                      {doc.fileName}
                                    </h4>
                                    <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200/50 shadow-sm">
                                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      {(doc.relevanceScore * 100).toFixed(1)}% relevant
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 mb-6">
                                    <div className="flex items-center bg-white/60 rounded-lg px-3 py-2">
                                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      <span className="font-medium">{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center bg-white/60 rounded-lg px-3 py-2">
                                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span className="font-medium">{doc.totalCharacters.toLocaleString()} chars</span>
                                    </div>
                                    <div className="flex items-center bg-white/60 rounded-lg px-3 py-2">
                                      <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      <span className="font-medium">{doc.chunkCount} section{doc.chunkCount !== 1 ? 's' : ''} found</span>
                                    </div>
                                  </div>
                                  {doc.labels && doc.labels.length > 0 && (
                                    <div className="flex flex-wrap gap-3 mb-6">
                                      {doc.labels.slice(0, 4).map((label: string, labelIndex: number) => (
                                        <span
                                          key={labelIndex}
                                          className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-green-50 to-green-100 text-green-700 border border-green-200/50 shadow-sm"
                                        >
                                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                          </svg>
                                          {label}
                                        </span>
                                      ))}
                                      {doc.labels.length > 4 && (
                                        <span className="text-sm text-gray-500 font-medium px-3 py-2">+{doc.labels.length - 4} more</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col space-y-3 ml-8">
                                  <button
                                    onClick={() => window.open(doc.fileUrl, '_blank')}
                                    className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                                  >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    View Document
                                  </button>
                                  <button
                                    onClick={() => handleLabelDocument(doc.docId, doc.labels || [])}
                                    className="inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-200 hover:border-gray-300 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                                  >
                                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    Manage Labels
                                  </button>
                                </div>
                              </div>
                              <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl p-6 border border-gray-200/50">
                                <div className="flex items-start">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg mr-4 flex-shrink-0">
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-gray-700 leading-relaxed text-base">
                                      {doc.previewText}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Pagination */}
                      <div className={'px-6 py-4 border-t border-gray-200 bg-gray-50 ' + (totalResults <= pageSize ? 'hidden' : '')}>
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-700">
                            Showing results
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => performSearch(query, caseName, currentPage - 1)}
                              disabled={currentPage === 1 || isLoading}
                              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </button>
                            <span className="text-sm text-gray-700">
                              Page {currentPage}
                            </span>
                            <button
                              onClick={() => performSearch(query, caseName, currentPage + 1)}
                              disabled={currentPage >= Math.ceil(totalResults / pageSize) || isLoading}
                              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : query ? (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No documents found</h3>
                      <p className="text-gray-600 mb-4">Try adjusting your search query or case name</p>
                      <div className="text-sm text-gray-500">
                        <p className="mb-1">💡 Try these suggestions:</p>
                        <ul className="text-left inline-block">
                          <li>• Use simpler keywords</li>
                          <li>• Check your case name spelling</li>
                          <li>• Try broader search terms</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="p-16 text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to search</h3>
                      <p className="text-gray-600">Enter a query above to find relevant documents</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar - Search Stats & Labels */}
            <div className="xl:col-span-1 space-y-8">
              {/* Search Statistics */}
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl shadow-blue-500/5 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-gray-200/50">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Search Statistics</h3>
                  </div>
                  <p className="text-sm text-gray-600">Real-time insights from your search</p>
                </div>
                <div className="p-6 space-y-6">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200/50 shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-blue-900">Documents Found</span>
                      <span className="text-3xl font-bold text-blue-700">{searchResults.length}</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-gray-100">
                      <span className="text-sm text-gray-600 font-medium">Case</span>
                      <span className="text-sm font-bold text-gray-900 truncate max-w-24" title={caseName}>{caseName}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-gray-600 font-medium">Query</span>
                      <span className="text-sm font-bold text-gray-900 truncate max-w-24" title={query}>{query || 'None'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Available Labels */}
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl shadow-green-500/5 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-green-50/80 to-emerald-50/80 border-b border-gray-200/50">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Document Labels</h3>
                  </div>
                  <p className="text-sm text-gray-600">Organize and categorize your documents</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {availableLabels.length > 0 ? (
                    <div className="p-6 space-y-4">
                      {availableLabels.map(label => (
                        <div
                          key={label}
                          className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-2xl hover:from-gray-100 hover:to-gray-200/50 transition-all duration-300 border border-gray-200/50 hover:border-gray-300/50 shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center shadow-sm mr-3">
                              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                              </svg>
                            </div>
                            <span className="text-sm font-bold text-gray-900">{label}</span>
                          </div>
                          <span className="inline-flex items-center px-3 py-1 text-xs font-bold bg-green-100 text-green-800 rounded-full border border-green-200/50 shadow-sm">
                            {searchResults.filter(doc => doc.labels?.includes(label)).length}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-500 mb-1">No labels yet</p>
                      <p className="text-xs text-gray-400">Labels help organize your documents</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white/95 backdrop-blur-sm rounded-3xl border border-gray-200/50 shadow-xl shadow-purple-500/5 overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-purple-50/80 to-pink-50/80 border-b border-gray-200/50">
                  <div className="flex items-center mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg mr-3">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Quick Actions</h3>
                  </div>
                  <p className="text-sm text-gray-600">Navigate and manage your workspace</p>
                </div>
                <div className="p-6 space-y-4">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full text-left px-6 py-4 text-sm font-semibold text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100/50 hover:from-gray-100 hover:to-gray-200/50 rounded-2xl transition-all duration-300 border border-gray-200/50 hover:border-gray-300/50 flex items-center shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md mr-4">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                      </svg>
                    </div>
                    <span>Back to Dashboard</span>
                  </button>
                  <button
                    onClick={() => loadAvailableLabels()}
                    className="w-full text-left px-6 py-4 text-sm font-semibold text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100/50 hover:from-gray-100 hover:to-gray-200/50 rounded-2xl transition-all duration-300 border border-gray-200/50 hover:border-gray-300/50 flex items-center shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-md mr-4">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <span>Refresh Labels</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/* Query Analysis */}
        {query && !isLoading && (
          <div className="mb-8">
            <div className="max-w-4xl mx-auto">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 p-4">
                <div className="flex items-start">
                  <svg className="w-5 h-5 mt-0.5 mr-3 text-purple-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-purple-900 mb-1">Query Analysis</h4>
                    <p className="text-sm text-purple-800">
                      Searching for: <span className="font-medium">"{query}"</span> in case: <span className="font-medium">{caseName}</span>
                      {relevanceThreshold > 0.1 && <span> • Minimum relevance: {(relevanceThreshold * 100).toFixed(0)}%</span>}
                      {dateFilter && <span> • Uploaded after: {new Date(dateFilter).toLocaleDateString()}</span>}
                    </p>
                    <div className="mt-2 text-xs text-purple-700">
                      💡 <strong>NLP Processing:</strong> Your query was analyzed using semantic search to find conceptually similar content across all your documents.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        </main>

        {/* Label Modal */}
        {showLabelModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Edit Document Labels</h3>
                  <button
                    onClick={() => setShowLabelModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Current Labels
                    </label>
                    <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-gray-50 rounded-lg border border-gray-200">
                      {currentLabels.length > 0 ? (
                        currentLabels.map((label, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800"
                          >
                            {label}
                            <button
                              onClick={() => setCurrentLabels(prev => prev.filter((_, i) => i !== index))}
                              className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No labels added yet</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-3">
                      Add New Label
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter label name..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.target as HTMLInputElement;
                            const newLabel = input.value.trim();
                            if (newLabel && !currentLabels.includes(newLabel)) {
                              setCurrentLabels(prev => [...prev, newLabel]);
                              input.value = '';
                            }
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const input = document.querySelector('input[placeholder="Enter label name..."]') as HTMLInputElement;
                          const newLabel = input?.value.trim();
                          if (newLabel && !currentLabels.includes(newLabel)) {
                            setCurrentLabels(prev => [...prev, newLabel]);
                            input.value = '';
                          }
                        }}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {availableLabels.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-3">
                        Quick Add Existing Labels
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableLabels
                          .filter(label => !currentLabels.includes(label))
                          .slice(0, 10)
                          .map(label => (
                            <button
                              key={label}
                              onClick={() => setCurrentLabels(prev => [...prev, label])}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                            >
                              + {label}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    onClick={() => setShowLabelModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveLabels(currentLabels)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Save Labels
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}