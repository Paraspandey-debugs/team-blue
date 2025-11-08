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
  const [availableLabels, setAvailableLabels] = useState<string[]>([]);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [labelingDocId, setLabelingDocId] = useState<string>('');
  const [currentLabels, setCurrentLabels] = useState<string[]>([]);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q, caseName);
    }
    loadAvailableLabels();
  }, [searchParams]);

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

  const performSearch = async (searchQuery: string, searchCaseName: string = caseName) => {
    setIsLoading(true);
    setAiAnswer('');
    setSearchResults([]);
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
      setSearchResults(data.documents || []);
      setAiAnswer(`Found ${data.totalResults} relevant documents for "${searchQuery}"`);
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

        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Search Bar */}
        <div className="mb-12">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8">
              <div className="space-y-8">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Search Your Documents</h2>
                  <p className="text-gray-600">Ask questions in natural language to find relevant information across all your legal documents</p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="case-name" className="block text-sm font-medium text-gray-900 mb-3">
                      Case Name
                    </label>
                    <input
                      id="case-name"
                      type="text"
                      value={caseName}
                      onChange={(e) => setCaseName(e.target.value)}
                      placeholder="Enter case name (e.g., smith-vs-jones)"
                      className="block w-full px-4 py-3 border border-gray-300 rounded-xl bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm shadow-sm transition-all duration-200"
                    />
                  </div>

                  <div className="relative">
                    <div className="relative bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200">
                      <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && performSearch(query, caseName)}
                        placeholder="Ask me anything about your legal documents... e.g., 'What are the key terms in the NDA?' or 'Summarize the contract obligations'"
                        className="w-full px-6 py-4 bg-transparent border-none rounded-2xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 resize-none min-h-[60px] text-lg leading-relaxed"
                        rows={1}
                        style={{ minHeight: '60px' }}
                        onInput={(e) => {
                          const target = e.target as HTMLTextAreaElement;
                          target.style.height = 'auto';
                          target.style.height = Math.min(target.scrollHeight, 200) + 'px';
                        }}
                      />
                      <button
                        onClick={() => performSearch(query, caseName)}
                        disabled={isLoading || !query.trim()}
                        className="absolute right-4 bottom-4 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        {isLoading ? (
                          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="mt-3 text-center">
                      <p className="text-sm text-gray-500">
                        Press Enter to search • Use natural language queries for best results
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Search Results - Documents */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <svg className="w-6 h-6 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <h3 className="text-xl font-semibold text-gray-900">Search Results</h3>
                    </div>
                    <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200">
                      {searchResults.length} document{searchResults.length !== 1 ? 's' : ''} found
                    </div>
                  </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                  {isLoading ? (
                    <div className="p-16 text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-gray-600 mt-4 font-medium">Searching your documents...</p>
                      <p className="text-sm text-gray-500 mt-2">This may take a few seconds for comprehensive results</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {searchResults.map((doc: any, index: number) => (
                        <div
                          key={doc.docId}
                          className="p-6 hover:bg-gray-50/50 transition-colors duration-200 group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-3 mb-3">
                                <h4 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                  {doc.fileName}
                                </h4>
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 border border-blue-200">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  {(doc.relevanceScore * 100).toFixed(1)}% match
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {new Date(doc.uploadedAt).toLocaleDateString()}
                                </div>
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  {doc.totalCharacters.toLocaleString()} characters
                                </div>
                                <div className="flex items-center">
                                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                  </svg>
                                  {doc.chunkCount} relevant chunks
                                </div>
                              </div>
                              {doc.labels && doc.labels.length > 0 && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                  {doc.labels.map((label: string, labelIndex: number) => (
                                    <span
                                      key={labelIndex}
                                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-green-50 to-green-100 text-green-700 border border-green-200"
                                    >
                                      <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                      </svg>
                                      {label}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex space-x-2 ml-6">
                              <button
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                View Document
                              </button>
                              <button
                                onClick={() => handleLabelDocument(doc.docId, doc.labels || [])}
                                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                Label
                              </button>
                            </div>
                          </div>
                          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200">
                            <div className="flex items-start">
                              <svg className="w-5 h-5 mt-0.5 mr-3 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="text-sm text-gray-700 leading-relaxed">{doc.previewText}</p>
                            </div>
                          </div>
                        </div>
                      ))}
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
            <div className="lg:col-span-1 space-y-6">
              {/* Search Statistics */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Search Statistics
                  </h3>
                  <p className="text-sm text-gray-600">Real-time insights from your search</p>
                </div>
                <div className="p-5 space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-900">Documents Found</span>
                      <span className="text-2xl font-bold text-blue-700">{searchResults.length}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Case</span>
                      <span className="text-sm font-medium text-gray-900 truncate max-w-20" title={caseName}>{caseName}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Query</span>
                      <span className="text-sm font-medium text-gray-900 truncate max-w-20" title={query}>{query || 'None'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Available Labels */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Document Labels
                  </h3>
                  <p className="text-sm text-gray-600">Organize and categorize your documents</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {availableLabels.length > 0 ? (
                    <div className="p-4 space-y-3">
                      {availableLabels.map(label => (
                        <div
                          key={label}
                          className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:from-gray-100 hover:to-gray-200 transition-all duration-200 border border-gray-200 hover:border-gray-300"
                        >
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-900">{label}</span>
                          </div>
                          <span className="inline-flex items-center px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full border border-green-200">
                            {searchResults.filter(doc => doc.labels?.includes(label)).length}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <p className="text-sm text-gray-500 mb-1">No labels yet</p>
                      <p className="text-xs text-gray-400">Labels help organize your documents</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Quick Actions
                  </h3>
                  <p className="text-sm text-gray-600">Navigate and manage your workspace</p>
                </div>
                <div className="p-4 space-y-3">
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300 flex items-center shadow-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                    </svg>
                    Back to Dashboard
                  </button>
                  <button
                    onClick={() => loadAvailableLabels()}
                    className="w-full text-left px-4 py-3 text-sm text-gray-700 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300 flex items-center shadow-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh Labels
                  </button>
                </div>
              </div>
            </div>
          </div>
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