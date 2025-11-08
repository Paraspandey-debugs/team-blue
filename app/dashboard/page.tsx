'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UniversalUploader from '../components/UniversalUploader';
import SearchBox from '../components/SearchBox';

export default function Dashboard() {
  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [stats, setStats] = useState({ documents: 0, searches: 0, insights: 0 });

  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (!token) {
      router.push('/login');
    }
    // Mock stats
    setStats({ documents: 42, searches: 156, insights: 23 });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background-primary)' }}>
      {/* Header */}
      <header className="shadow-chatgpt border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--background-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Atlas</h1>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 rounded-xl text-sm leading-4 font-medium shadow-chatgpt hover:shadow-chatgpt-hover transition-all duration-200"
              style={{
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Vertically Centered */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8">
        <div className="w-full max-w-4xl space-y-8">
          {/* Search Section - Top */}
          <div className="text-center">
            <h3 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>Search Documents</h3>
            <div className="max-w-2xl mx-auto">
              <SearchBox onSearch={(query: string) => router.push(`/search?q=${encodeURIComponent(query)}`)} />
            </div>
          </div>

          {/* Upload Section - Bottom, Centered */}
          <div className="text-center">

            <div className="max-w-sm mx-auto">
              <div className="rounded-xl shadow-chatgpt p-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                <UniversalUploader />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}