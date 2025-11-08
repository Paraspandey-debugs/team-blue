'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function SearchBox({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setQuery(q);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (query.trim()) {
        onSearch(query);
      }
    }
  };

  return (
    <div className="relative">
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Ask anything about your documents..."
        className="w-full h-40 p-6 text-lg rounded-xl resize-none shadow-chatgpt hover:shadow-chatgpt-hover focus:shadow-chatgpt-hover transition-all duration-200"
        style={{
          backgroundColor: 'var(--background-secondary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)'
        }}
        rows={5}
      />
      <button
        onClick={handleSubmit}
        disabled={!query.trim()}
        className="absolute bottom-4 right-4 p-3 rounded-xl shadow-chatgpt hover:shadow-chatgpt-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        style={{
          backgroundColor: 'var(--accent)',
          color: '#ffffff'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
}