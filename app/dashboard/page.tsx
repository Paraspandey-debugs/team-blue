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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Atlas</h1>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - Vertically Centered */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {/* Upload Section - Left Side, Smaller Height */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-fit">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upload Documents</h3>
              <UniversalUploader />
            </div>
          </div>

          {/* Search Section - Right Side, Larger */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Search Documents</h3>
            <SearchBox onSearch={(query: string) => router.push(`/search?q=${encodeURIComponent(query)}`)} />
          </div>
        </div>
      </main>
    </div>
  );
}