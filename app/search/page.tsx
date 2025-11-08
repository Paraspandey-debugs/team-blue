'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function Search() {
  const [query, setQuery] = useState('');
  const [caseName, setCaseName] = useState('default-case');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
    } catch (error: any) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              ← Back
            </button>
            <h1 className="text-base font-semibold">Search</h1>
          </div>
          <span className="text-sm opacity-40">{searchResults.length} results</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-8 py-8">
        <div className="space-y-4 mb-8">
          <input
            type="text"
            placeholder="Case name"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            className="w-full px-4 py-2 bg-[var(--hover)] border border-[var(--border)] rounded-lg text-sm placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
          />
          
          <div className="relative">
            <input
              type="text"
              placeholder="Search documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && performSearch(query, caseName)}
              className="w-full px-4 py-3 bg-[var(--hover)] border border-[var(--border)] rounded-lg placeholder:opacity-40 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
            />
            <button
              onClick={() => performSearch(query, caseName)}
              disabled={isLoading}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--accent)] hover:opacity-80 disabled:opacity-40"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 opacity-60">Searching...</p>
          </div>
        )}

        {!isLoading && searchResults.length === 0 && query && (
          <div className="text-center py-12">
            <p className="opacity-60">No documents found</p>
          </div>
        )}

        <div className="space-y-3">
          {searchResults.map((doc: any) => (
            <div
              key={doc.docId}
              className="p-6 bg-[var(--hover)] hover:bg-[var(--border)] border border-[var(--border)] rounded-lg transition-colors cursor-pointer"
              onClick={() => window.open(doc.fileUrl, '_blank')}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-medium mb-1">{doc.fileName}</h3>
                  <div className="flex items-center gap-3 text-sm opacity-60">
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{Math.round(doc.relevanceScore * 100)}% match</span>
                  </div>
                </div>
              </div>
              
              {doc.previewText && (
                <p className="text-sm opacity-80 leading-relaxed">{doc.previewText}</p>
              )}
              
              {doc.labels && doc.labels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {doc.labels.map((label: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-[var(--accent)] bg-opacity-10 text-[var(--accent)] rounded"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
