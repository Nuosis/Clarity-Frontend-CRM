import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { signInWithEmail } from '../../services/supabaseService';

/**
 * SignIn Component - Handles Supabase authentication for the web app
 *
 * This component provides Supabase email/password authentication.
 * Legacy authentication has been removed as part of the frontend migration.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onSupabaseAuth - Callback when Supabase authentication succeeds
 */
const SignIn = ({ onSupabaseAuth }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Supabase authentication
  const handleSupabaseSignIn = useCallback(async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signInWithEmail(email, password);
      
      if (!result.success) {
        throw new Error(result.error);
      }

      console.log('[SignIn] Supabase authentication successful');
      onSupabaseAuth({
        isAuthenticated: true,
        method: 'supabase',
        user: result.data.user
      });
    } catch (err) {
      console.error('[SignIn] Supabase authentication error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [email, password, onSupabaseAuth]);

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-900 flex items-center justify-center p-8">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-8 w-full max-w-md border dark:border-gray-700">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Clarity CRM
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Business Management Platform
          </p>
        </div>

        {/* Authentication Form */}
        <form onSubmit={handleSupabaseSignIn} className="space-y-6">
          {/* Email Input */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 transition-colors placeholder-gray-500 dark:placeholder-gray-400"
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Signing In...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Clarity Business Solutions</p>
          <p>Secure Authentication System</p>
        </div>
      </div>
    </div>
  );
};

SignIn.propTypes = {
  onSupabaseAuth: PropTypes.func.isRequired
};

export default SignIn;
