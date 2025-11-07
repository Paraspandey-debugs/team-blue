'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function Search() {
  const [query, setQuery] = useState('');
  const [caseName, setCaseName] = useState('default-case');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [preview, setPreview] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q, caseName);
    }
  }, [searchParams]);

  const performSearch = async (searchQuery: string, searchCaseName: string = caseName) => {
    setIsLoading(true);
    setAiAnswer('');
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
        body: JSON.stringify({ query: searchQuery, caseName: searchCaseName }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Search failed');
      }

      const data = await response.json();
      setAiAnswer(data.answer || 'No answer available');
      setSearchResults(data.match_scores || []);
    } catch (error: any) {
      console.error('Search error:', error);
      setAiAnswer(error.message || 'Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = async (file: string) => {
    setSelectedFile(file);
    setIsLoading(true);
    // Mock preview generation
    await new Promise(resolve => setTimeout(resolve, 500));
    setPreview(`Document Preview: ${file}\n\nThis is a comprehensive legal document containing various clauses and provisions. The content has been processed and is ready for analysis.\n\nKey sections include:\n- Definitions\n- Obligations\n- Termination clauses\n- Dispute resolution\n\nFor full text, please refer to the original document.`);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-100 dark:bg-purple-900/20 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-pulse animation-delay-1000"></div>
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
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Document Search</h1>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {searchResults.length} results found
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          {/* Search Bar */}
          <div className="mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label htmlFor="case-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Case Name
                    </label>
                    <input
                      id="case-name"
                      type="text"
                      value={caseName}
                      onChange={(e) => setCaseName(e.target.value)}
                      placeholder="Enter case name (e.g., default-case)"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm mb-2"
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <label htmlFor="search-query" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Search Query
                    </label>
                    <input
                      id="search-query"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && performSearch(query, caseName)}
                      placeholder="Ask anything about your documents..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    />
                  </div>
                  <button
                    onClick={() => performSearch(query, caseName)}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 flex items-center dark:focus:ring-offset-gray-900 self-end"
                  >
                    {isLoading ? (
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                    {isLoading ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* AI Answer */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Answer
                  </h3>
                </div>
                <div className="p-6">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                      <span className="ml-3 text-gray-600 dark:text-gray-400">Analyzing documents...</span>
                    </div>
                  ) : aiAnswer ? (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                      <div className="prose prose-gray dark:prose-invert max-w-none">
                        <p className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No answer yet</h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Enter a search query to get AI-powered answers from your documents.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Search Results / Match Scores */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Relevant Chunks
                  </h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {isLoading ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-gray-500 dark:text-gray-400 mt-2">Finding matches...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <div
                        key={index}
                        className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">{result.content_preview}</p>
                          </div>
                          <div className="ml-2 flex-shrink-0">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                              {(result.score * 100).toFixed(0)}% match
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                      {aiAnswer ? 'No chunk details available' : 'Search to see relevant document chunks'}
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Filters */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Filters</h3>
                <div className="space-y-2">
                  {['Recent Documents', 'High Priority', 'Pending Review', 'Confidential'].map(filter => (
                    <button
                      key={filter}
                      className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors duration-200"
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}