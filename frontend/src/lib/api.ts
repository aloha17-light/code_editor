// =============================================================================
// API Client (Axios Instance)
// =============================================================================
// Centralized HTTP client for communicating with the backend API (Layer 2).
//
// Features:
//   1. Base URL from environment variable (NEXT_PUBLIC_API_URL)
//   2. Automatic JWT attachment via request interceptor
//   3. Automatic 401 handling via response interceptor (clears stale tokens)
//
// Usage:
//   import api from '@/lib/api';
//   const { data } = await api.get('/auth/profile');
// =============================================================================

import axios from 'axios';

/**
 * Axios instance pre-configured with the backend base URL.
 * All API calls should use this instance instead of raw axios.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000, // 60 second timeout for AI generation
});

// =============================================================================
// Request Interceptor — Attach JWT to every outgoing request
// =============================================================================
// Reads the token from localStorage (client-side only).
// If a token exists, it's added as a Bearer token in the Authorization header.
// =============================================================================

api.interceptors.request.use(
  (config) => {
    // Only access localStorage on the client side (Next.js SSR guard)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// =============================================================================
// Response Interceptor — Handle 401 Unauthorized globally
// =============================================================================
// If the backend returns 401 (e.g., expired JWT), we clear the stored token
// and redirect to the login page. This prevents stale sessions from causing
// confusing UI states.
// =============================================================================

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Clear auth state
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Redirect to login (avoid redirect loops if already on login page)
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
