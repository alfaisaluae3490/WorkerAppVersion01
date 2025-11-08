// frontend/pages/dashboard/customer.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiBriefcase, 
  FiPlusCircle, 
  FiUser, 
  FiLogOut, 
  FiSearch,
  FiMapPin,
  FiClock,
  FiCalendar,
  FiDollarSign,
  FiMessageSquare,
  FiStar,
  FiSettings,
  FiRepeat,
  FiCheckCircle,
  FiEye,
  FiAlertTriangle,
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { jobsAPI } from '../../utils/apiClient';
import toast from 'react-hot-toast';
import NotificationBell from '../../components/NotificationBell';

export default function CustomerDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const switchRole = useAuthStore((state) => state.switchRole);
  const setUser = useAuthStore((state) => state.setUser);
  const [activeTab, setActiveTab] = useState('my-jobs');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Real data from API
  const [myJobs, setMyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeJobs: 0,
    totalBids: 0,
    completed: 0,
    totalSpent: 0
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchMyJobs();
    }
  }, [isAuthenticated, router]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileOpen && !event.target.closest('.profile-dropdown')) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  // Fetch real jobs from database
  const fetchMyJobs = async () => {
    try {
      setLoading(true);
      const response = await jobsAPI.getMyJobs();
      
      if (response.success) {
        const jobs = response.data?.jobs || [];
        setMyJobs(jobs);
        
        // Calculate stats
        const activeJobs = jobs.filter(j => j.status === 'open' || j.status === 'assigned' || j.status === 'in_progress').length;
        const totalBids = jobs.reduce((sum, job) => sum + (parseInt(job.bids_count) || 0), 0);
        const completed = jobs.filter(j => j.status === 'completed').length;
        
        setStats({
          activeJobs,
          totalBids,
          completed,
          totalSpent: 0
        });
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      toast.error('Failed to load your jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const handleSwitchToWorker = async () => {
    try {
      const response = await switchRole('worker');
      if (response.success) {
        setUser(response.data.user);
        toast.success('Switched to Worker mode');
        router.push('/dashboard/worker');
      }
    } catch (error) {
      console.error('Switch role error:', error);
      toast.error('Failed to switch role');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // ✅ Get status badge styling
  const getStatusBadge = (status) => {
    const statusConfig = {
      open: { bg: 'bg-green-100', text: 'text-green-800', label: 'Open', icon: null },
      assigned: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Assigned', icon: null },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress', icon: null },
      completed: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Completed', icon: FiCheckCircle },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled', icon: null },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status, icon: null };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} flex items-center gap-1`}>
        {config.icon && <config.icon size={14} />}
        {config.label}
      </span>
    );
  };

  // ✅ Check if job allows viewing bids
  const canViewBids = (job) => {
    return job.status === 'open' && (job.bids_count > 0);
  };

  // ✅ Check if job has active booking
  const hasActiveBooking = (job) => {
    return job.booking_id && (job.status === 'assigned' || job.status === 'in_progress');
  };

  // ✅ Check if job is completed
  const isJobCompleted = (job) => {
    return job.status === 'completed';
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Customer Dashboard - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header/Navbar */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <Link href="/">
                <h1 className="text-2xl font-bold text-blue-600 cursor-pointer">
                  Services Marketplace
                </h1>
              </Link>

          

              {/* Right Side */}
              <div className="flex items-center gap-4">
                <NotificationBell />
                
                {/* Profile Dropdown */}
                <div className="relative profile-dropdown">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                      {user.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden md:block font-medium text-gray-700">
                      {user.full_name}
                    </span>
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
                      <div className="px-4 py-3 border-b border-gray-200">
                        <p className="text-sm font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>

                      <Link href="/dashboard/profile">
                        <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <FiUser size={16} />
                          Profile Settings
                        </button>
                      </Link>

                      <button
                        onClick={handleSwitchToWorker}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FiRepeat size={16} />
                        Switch to Worker
                      </button>

                      <div className="border-t border-gray-200 mt-2 pt-2">
                        <button
                          onClick={handleLogout}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <FiLogOut size={16} />
                          Logout
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user.full_name}! 👋
            </h2>
            <p className="text-gray-600">Manage your posted jobs and track their progress</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Active Jobs</span>
                <FiBriefcase className="text-blue-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.activeJobs}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Total Bids</span>
                <FiStar className="text-yellow-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalBids}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Completed</span>
                <FiCheckCircle className="text-green-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.completed}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Total Spent</span>
                <FiDollarSign className="text-purple-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">₨{stats.totalSpent.toLocaleString()}</p>
            </div>
          </div>

  {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Link href="/post-job">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Post a New Job</h3>
                    <p className="text-blue-100 text-sm">Get quotes from skilled workers</p>
                  </div>
                  <FiPlusCircle size={48} className="opacity-80" />
                </div>
              </div>
            </Link>

            <Link href="/my-reports">
              <div className="bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl p-6 text-white cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold mb-2">My Reports</h3>
                    <p className="text-orange-100 text-sm">Track issues and chat with admin</p>
                  </div>
                  <FiAlertTriangle size={48} className="opacity-80" />
                </div>
              </div>
            </Link>
          </div>

          {/* My Jobs Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">My Posted Jobs</h3>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading your jobs...</p>
              </div>
            ) : myJobs.length === 0 ? (
              <div className="p-12 text-center">
                <FiBriefcase size={48} className="mx-auto text-gray-300 mb-4" />
                <h4 className="text-lg font-semibold text-gray-900 mb-2">No jobs posted yet</h4>
                <p className="text-gray-600 mb-6">Get started by posting your first job</p>
                <Link href="/post-job">
                  <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">
                    Post a Job
                  </button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {myJobs.map((job) => (
                  <div key={job.id} className="p-6 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Link href={`/jobs/${job.id}`}>
                            <h4 className="text-lg font-semibold text-gray-900 hover:text-blue-600 cursor-pointer">
                              {job.title}
                            </h4>
                          </Link>
                          {getStatusBadge(job.status)}
                        </div>
                        <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                          {job.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                      <div className="flex items-center gap-1">
                        <FiMapPin size={16} />
                        <span>{job.city}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FiClock size={16} />
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FiDollarSign size={16} />
                        <span className="font-semibold text-green-600">
                          ₨{job.budget_min?.toLocaleString()} - ₨{job.budget_max?.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FiStar size={16} />
                        <span className="font-semibold text-blue-600">
                          {job.bids_count || 0} Bids
                        </span>
                      </div>
                    </div>

                    {/* ✅ UPDATED: Conditional action buttons based on job status */}
                    <div className="flex gap-3">
                      {isJobCompleted(job) ? (
                        <>
                          <Link href={`/jobs/${job.id}`}>
                            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm flex items-center gap-2">
                              <FiEye size={16} />
                              View Details
                            </button>
                          </Link>
                          {job.booking_id && (
                            <Link href={`/chat/${job.booking_id}`}>
                              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium text-sm flex items-center gap-2">
                                <FiMessageSquare size={16} />
                                View Chat History
                              </button>
                            </Link>
                          )}
                        </>
                      ) : hasActiveBooking(job) ? (
                        <>
                          <Link href={`/jobs/${job.id}`}>
                            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm flex items-center gap-2">
                              <FiEye size={16} />
                              View Details
                            </button>
                          </Link>
                          <Link href={`/chat/${job.booking_id}`}>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2">
                              <FiMessageSquare size={16} />
                              Open Chat
                            </button>
                          </Link>
                        </>
                      ) : canViewBids(job) ? (
                        <>
                          <Link href={`/jobs/${job.id}/bids`}>
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                              View {job.pending_bids || job.bids_count || 0} Bids
                            </button>
                          </Link>
                          <Link href={`/jobs/${job.id}`}>
                            <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                              View Details
                            </button>
                          </Link>
                        </>
                      ) : (
                        <Link href={`/jobs/${job.id}`}>
                          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm flex items-center gap-2">
                            <FiEye size={16} />
                            View Details
                          </button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}