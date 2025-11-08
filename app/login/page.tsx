'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (data.success) {
        localStorage.setItem('jwt_token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background-primary)' }}>
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Welcome to ClauseIQ
          </h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Secure access to your contract intelligence platform
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 rounded-xl shadow-chatgpt focus:shadow-chatgpt-hover transition-all duration-200"
                style={{
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 rounded-xl shadow-chatgpt focus:shadow-chatgpt-hover transition-all duration-200"
                style={{
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-red-600 text-sm" style={{ color: '#ef4444' }}>{error}</p>}
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 rounded-xl shadow-chatgpt hover:shadow-chatgpt-hover disabled:opacity-50 transition-all duration-200"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#ffffff'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent)'}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </div>
        </form>
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <a href="/signup" className="font-medium hover:underline transition-all duration-200" style={{ color: 'var(--accent)' }}>
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}