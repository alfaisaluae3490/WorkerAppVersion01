// frontend/pages/admin/dashboard.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FiUsers,
  FiBriefcase,
  FiDollarSign,
  FiAlertCircle,
  FiTrendingUp,
  FiFileText,
  FiSettings,
  FiLogOut,
  FiSearch,
  FiFilter
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Wait a bit for auth store to hydrate from localStorage
    const timer = setTimeout(() => {
      setAuthChecked(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    // Check authentication and role
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (!token || !isAuthenticated) {
      toast.error('Please login to access admin portal');
      router.push('/login');
      return;
    }

    if (user?.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.');
      router.push('/');
      return;
    }

    // If all checks pass, fetch analytics
    fetchAnalytics();
  }, [authChecked, isAuthenticated, user]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Session expired. Please login again.');
        router.push('/login');
        return;
      }

      const response = await fetch('http://localhost:5000/api/admin/dashboard/analytics', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        toast.error('Session expired or access denied. Please login again.');
        logout();
        router.push('/login');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      if (data.success) {
        setAnalytics(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch analytics');
      }
    } catch (error) {
      console.error('Fetch analytics error:', error);
      toast.error(error.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = analytics?.stats || {};

  return (
    <>
      <Head>
        <title>Admin Dashboard - GWorkerApp</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
                <p className="text-sm text-gray-600">GWorkerApp Platform Management</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600">Welcome, {user?.full_name}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <FiLogOut />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>






 {/* Navigation Tabs */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <Link href="/admin/dashboard" className="py-4 px-1 border-b-2 border-blue-600 font-medium text-blue-600">
                Dashboard
              </Link>
              <Link href="/admin/users" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300">
                Users
              </Link>
              <Link href="/admin/jobs" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300">
                Jobs
              </Link>
              <Link href="/admin/reports" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300">
                Reports
              </Link>
              <Link href="/admin/disputes" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300">
                Disputes
              </Link>
              <Link href="/admin/categories" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300">
                Categories
              </Link>
              <Link href="/admin/locations" className="py-4 px-1 border-b-2 border-transparent font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300">
                Locations
              </Link>
            </div>
          </div>
        </nav>




        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Users */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FiUsers className="w-6 h-6 text-blue-600" />
                </div>
                <span className="text-sm text-gray-600">Total Users</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_customers + stats.total_workers || 0}</div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-gray-600">Customers: {stats.total_customers || 0}</span>
                <span className="text-gray-600">Workers: {stats.total_workers || 0}</span>
              </div>
            </div>

            {/* Total Jobs */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <FiBriefcase className="w-6 h-6 text-green-600" />
                </div>
                <span className="text-sm text-gray-600">Total Jobs</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">{stats.total_jobs || 0}</div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-green-600">Open: {stats.open_jobs || 0}</span>
                <span className="text-gray-600">Completed: {stats.completed_jobs || 0}</span>
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <FiDollarSign className="w-6 h-6 text-purple-600" />
                </div>
                <span className="text-sm text-gray-600">Total Revenue</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                ${parseFloat(stats.total_revenue || 0).toLocaleString()}
              </div>
              <div className="mt-2 text-sm text-gray-600">
                Bookings: {stats.total_bookings || 0}
              </div>
            </div>

            {/* Pending Items */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <FiAlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <span className="text-sm text-gray-600">Needs Attention</span>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {(stats.open_disputes || 0) + (stats.pending_reports || 0)}
              </div>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="text-red-600">Disputes: {stats.open_disputes || 0}</span>
                <span className="text-orange-600">Reports: {stats.pending_reports || 0}</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Link href="/admin/users" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FiUsers className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Manage Users</h3>
                  <p className="text-sm text-gray-600">View, verify, suspend users</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/reports" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <FiFileText className="w-8 h-8 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Review Reports</h3>
                  <p className="text-sm text-gray-600">{stats.pending_reports || 0} pending reports</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/disputes" className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <FiAlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Resolve Disputes</h3>
                  <p className="text-sm text-gray-600">{stats.open_disputes || 0} open disputes</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Recent Activity & Top Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Categories */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Top Categories</h2>
                <p className="text-sm text-gray-600">Most popular job categories</p>
              </div>
              <div className="p-6">
                {analytics?.topCategories && analytics.topCategories.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.topCategories.map((category, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-gray-900">{category.name}</span>
                        <span className="text-sm text-gray-600">{category.job_count} jobs</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No data available</p>
                )}
              </div>
            </div>

            {/* Revenue by Month */}
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">Revenue Trend</h2>
                <p className="text-sm text-gray-600">Last 6 months</p>
              </div>
              <div className="p-6">
                {analytics?.revenueByMonth && analytics.revenueByMonth.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.revenueByMonth.slice(0, 6).map((item, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-gray-900">{item.month}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            ${parseFloat(item.total_amount || 0).toLocaleString()}
                          </div>
                          <div className="text-xs text-gray-600">{item.bookings_count} bookings</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No revenue data available</p>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}