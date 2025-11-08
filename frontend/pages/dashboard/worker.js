// frontend/pages/dashboard/worker.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FiBriefcase,
  FiDollarSign,
  FiStar,
  FiUser,
  FiLogOut,
  FiSettings,
  FiRepeat,
  FiTrendingUp,
  FiCheckCircle,
  FiClock,
  FiMapPin,
  FiMessageSquare,
  FiAward,
  FiLock
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { jobsAPI, bidsAPI } from '../../utils/apiClient';
import apiClient from '../../utils/apiClient';
import toast from 'react-hot-toast';
import NotificationBell from '../../components/NotificationBell';

export default function WorkerDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const logout = useAuthStore((state) => state.logout);
  const switchRole = useAuthStore((state) => state.switchRole);
  const setUser = useAuthStore((state) => state.setUser);

  const [activeTab, setActiveTab] = useState('available');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availableJobs, setAvailableJobs] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [acceptedJobs, setAcceptedJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [workerProfile, setWorkerProfile] = useState(null);
  const [stats, setStats] = useState({
    successRate: 0,
    jobsCompleted: 0,
    rating: 0,
    totalEarned: 0
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchDashboardData();
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isProfileOpen && !event.target.closest('.profile-dropdown')) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileOpen]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Fetch worker profile FIRST to get city for filtering
      await fetchWorkerStats();
      // Then fetch jobs and other data
      await Promise.all([
        fetchAvailableJobs(),
        fetchMyBids(),
        fetchAcceptedJobs(),
        fetchCompletedJobs()
      ]);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableJobs = async () => {
    try {
      // First get worker profile if not already loaded
      if (!workerProfile) {
        const profileResponse = await apiClient.get('/profiles/worker/me');
        if (profileResponse.success) {
          setWorkerProfile(profileResponse.data.profile);
        }
      }

      // Fetch jobs filtered by worker's city AND services
      const queryParams = { status: 'open' };
      
      // Add city filter if worker has a city in profile
      if (workerProfile?.city) {
        queryParams.worker_city = workerProfile.city;
      }

      // Add worker_id to filter jobs by worker's service categories
      if (user?.id) {
        queryParams.worker_id = user.id;
      }

      const response = await jobsAPI.getJobs(queryParams);
      if (response.success) {
        setAvailableJobs(response.data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching available jobs:', error);
    }
  };

  const fetchMyBids = async () => {
    try {
      const response = await bidsAPI.getMyBids();
      if (response.success) {
        setMyBids(response.data.bids || []);
      }
    } catch (error) {
      console.error('Error fetching my bids:', error);
    }
  };

  const fetchAcceptedJobs = async () => {
    try {
      const response = await apiClient.get('/bookings', {
        params: { role: 'worker', status: 'confirmed,in_progress' }
      });
      if (response.success) {
        const bookings = response.data.bookings || [];
        setAcceptedJobs(bookings);
      }
    } catch (error) {
      console.error('Error fetching accepted jobs:', error);
    }
  };

  const fetchCompletedJobs = async () => {
    try {
      const response = await apiClient.get('/bookings', {
        params: { role: 'worker', status: 'completed' }
      });
      if (response.success) {
        const bookings = response.data.bookings || [];
        setCompletedJobs(bookings);
      }
    } catch (error) {
      console.error('Error fetching completed jobs:', error);
    }
  };

  const fetchWorkerStats = async () => {
    try {
      const response = await apiClient.get('/profiles/worker/me');
      if (response.success) {
        const profile = response.data.profile;
        setWorkerProfile(profile); // Store profile with city info
        setStats({
          successRate: profile?.total_jobs_completed > 0 
            ? Math.round((profile.total_jobs_completed / (profile.total_jobs_completed + 1)) * 100) 
            : 0,
          jobsCompleted: profile?.total_jobs_completed || 0,
          rating: profile?.average_rating || 0,
          totalEarned: 0
        });
      }
    } catch (error) {
      console.error('Error fetching worker stats:', error);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const handleSwitchToCustomer = async () => {
    try {
      const response = await switchRole('customer');
      if (response.success) {
        setUser(response.data.user);
        toast.success('Switched to Customer mode');
        router.push('/dashboard/customer');
      }
    } catch (error) {
      console.error('Switch role error:', error);
      toast.error('Failed to switch role');
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return date.toLocaleDateString();
  };

  const getBidStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      accepted: { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      withdrawn: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Withdrawn' },
    };
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getJobStatusBadge = (status) => {
    const statusConfig = {
      confirmed: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Confirmed', icon: null },
      in_progress: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'In Progress', icon: <FiClock size={14} /> },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed', icon: <FiCheckCircle size={14} /> },
    };
    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status, icon: null };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} flex items-center gap-1`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Worker Dashboard - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link href="/">
                <h1 className="text-2xl font-bold text-green-600 cursor-pointer">
                  Services Marketplace
                </h1>
              </Link>

              <nav className="hidden md:flex items-center gap-6">
                <Link href="/browse-jobs">
                  <button className="text-gray-700 hover:text-green-600 font-medium transition">
                    Find Jobs
                  </button>
                </Link>
                <Link href="/messages">
                  <button className="text-gray-700 hover:text-green-600 font-medium transition">
                    Messages
                  </button>
                </Link>
              </nav>

              <div className="flex items-center gap-4">
                <NotificationBell />
                
                <div className="relative profile-dropdown">
                  <button
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
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

                      <Link href="/dashboard/worker-profile">
                        <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <FiUser size={16} />
                          Worker Profile Settings
                        </button>
                      </Link>

                      <Link href="/dashboard/profile">
                        <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <FiUser size={16} />
                          Personal Profile
                        </button>
                      </Link>

                      <button
                        onClick={handleSwitchToCustomer}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <FiRepeat size={16} />
                        Switch to Customer
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
          <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-8 text-white mb-8">
            <h2 className="text-3xl font-bold mb-2">Welcome, {user.full_name}!</h2>
            <p className="text-green-100">Find jobs that match your skills</p>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FiTrendingUp size={24} />
                  <span className="text-sm font-medium text-green-100">Success Rate</span>
                </div>
                <p className="text-3xl font-bold">{stats?.successRate || 0}%</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FiCheckCircle size={24} />
                  <span className="text-sm font-medium text-green-100">Jobs Completed</span>
                </div>
                <p className="text-3xl font-bold">{stats?.jobsCompleted || 0}</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <FiStar size={24} />
                  <span className="text-sm font-medium text-green-100">Your Rating</span>
                </div>
                <p className="text-3xl font-bold">{Number(stats?.rating || 0).toFixed(1)} ⭐</p>
              </div>
            </div>
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Available Jobs</span>
                <FiBriefcase className="text-blue-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{availableJobs.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">My Bids</span>
                <FiStar className="text-yellow-500" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{myBids.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Active Jobs</span>
                <FiClock className="text-purple-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">{acceptedJobs.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-600 text-sm font-medium">Total Earned</span>
                <FiDollarSign className="text-green-600" size={24} />
              </div>
              <p className="text-3xl font-bold text-gray-900">Rs{stats?.totalEarned || 0}K</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto">
                <button
                  onClick={() => setActiveTab('available')}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                    activeTab === 'available'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Available Jobs
                </button>
                <button
                  onClick={() => setActiveTab('bids')}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                    activeTab === 'bids'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  My Bids
                </button>
                <button
                  onClick={() => setActiveTab('accepted')}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                    activeTab === 'accepted'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Accepted Jobs ({acceptedJobs.length})
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-6 py-4 font-medium text-sm whitespace-nowrap border-b-2 transition ${
                    activeTab === 'completed'
                      ? 'border-green-600 text-green-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Completed Jobs
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading...</p>
                </div>
              ) : (
                <>
                  {/* Available Jobs Tab */}
                  {activeTab === 'available' && (
                    <div className="space-y-4">
                      {availableJobs.length === 0 ? (
                        <div className="text-center py-12">
                          <FiBriefcase size={48} className="mx-auto text-gray-300 mb-4" />
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No jobs available</h4>
                          <p className="text-gray-600">Check back later for new opportunities</p>
                        </div>
                      ) : (
                        availableJobs.map((job) => (
                          <div key={job.id} className="border border-gray-200 rounded-lg p-6 hover:border-green-600 transition">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <Link href={`/jobs/${job.id}`}>
                                  <h4 className="text-lg font-semibold text-gray-900 hover:text-green-600 cursor-pointer mb-2">
                                    {job.title}
                                  </h4>
                                </Link>
                                <p className="text-gray-600 text-sm line-clamp-2 mb-3">{job.description}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                              <div className="flex items-center gap-1">
                                <FiMapPin size={16} />
                                <span>{job.city}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiClock size={16} />
                                <span>{getTimeAgo(job.created_at)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiDollarSign size={16} />
                                <span className="font-semibold text-green-600">
                                  Rs{job.budget_min?.toLocaleString()} - Rs{job.budget_max?.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <FiStar size={16} />
                                <span>{job.bids_count || 0} bids placed</span>
                              </div>
                            </div>

                            <Link href={`/jobs/${job.id}`}>
                              <button className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm">
                                View Details & Place Bid
                              </button>
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* My Bids Tab */}
                  {activeTab === 'bids' && (
                    <div className="space-y-4">
                      {myBids.length === 0 ? (
                        <div className="text-center py-12">
                          <FiStar size={48} className="mx-auto text-gray-300 mb-4" />
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No bids yet</h4>
                          <p className="text-gray-600">Start bidding on available jobs</p>
                        </div>
                      ) : (
                        myBids.map((bid) => (
                          <div key={bid.id} className="border border-gray-200 rounded-lg p-6">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <Link href={`/jobs/${bid.job_id}`}>
                                  <h4 className="text-lg font-semibold text-gray-900 hover:text-green-600 cursor-pointer mb-2">
                                    {bid.job_title}
                                  </h4>
                                </Link>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-sm text-gray-600">Your Bid:</span>
                                  <span className="text-lg font-bold text-green-600">Rs{bid.amount?.toLocaleString()}</span>
                                  {getBidStatusBadge(bid.status)}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-4">
                              <div className="flex items-center gap-1">
                                <FiClock size={16} />
                                <span>Bid placed {getTimeAgo(bid.created_at)}</span>
                              </div>
                            </div>

                            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg mb-4">
                              <strong>Your Proposal:</strong> {bid.message}
                            </p>

                            <Link href={`/jobs/${bid.job_id}`}>
                              <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                                View Job Details
                              </button>
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Accepted Jobs Tab */}
                  {activeTab === 'accepted' && (
                    <div className="space-y-4">
                      {acceptedJobs.length === 0 ? (
                        <div className="text-center py-12">
                          <FiCheckCircle size={48} className="mx-auto text-gray-300 mb-4" />
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No accepted jobs</h4>
                          <p className="text-gray-600">Your accepted jobs will appear here</p>
                        </div>
                      ) : (
                        acceptedJobs.map((job) => (
                          <div key={job.id} className="bg-green-50 border border-green-200 rounded-lg p-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <FiCheckCircle className="text-green-600" size={20} />
                                  <h4 className="text-lg font-semibold text-gray-900">{job.job_title}</h4>
                                  {getJobStatusBadge(job.status)}
                                </div>
                                <div className="mb-3">
                                  <span className="text-sm text-gray-600">Your Bid Amount:</span>
                                  <p className="text-xl font-bold text-green-600">Rs{job.agreed_amount?.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 mb-4">
                              <h5 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                                <FiUser size={16} />
                                Customer Information
                              </h5>
                              <p className="text-sm"><strong>Name:</strong> {job.customer_name}</p>
                              <p className="text-sm"><strong>Email:</strong> {job.customer_email || 'noufal@a.com'}</p>
                              <p className="text-sm"><strong>Phone:</strong> {job.customer_phone || '123567545675'}</p>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                              <p className="text-sm text-blue-800">
                                <strong>Your Proposal:</strong> im the best
                              </p>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                              <FiClock size={16} />
                              <span>Accepted {getTimeAgo(job.created_at)}</span>
                            </div>

                            <div className="flex gap-3">
                              <Link href={`/jobs/${job.job_id}`}>
                                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                                  View Job Details
                                </button>
                              </Link>
                              <Link href={`/chat/${job.id}`}>
                                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center justify-center gap-2">
                                  <FiMessageSquare size={16} />
                                  Contact Customer
                                </button>
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Completed Jobs Tab */}
                  {activeTab === 'completed' && (
                    <div className="space-y-4">
                      {completedJobs.length === 0 ? (
                        <div className="text-center py-12">
                          <FiAward size={48} className="mx-auto text-gray-300 mb-4" />
                          <h4 className="text-lg font-semibold text-gray-900 mb-2">No completed jobs</h4>
                          <p className="text-gray-600">Your completed jobs will appear here</p>
                        </div>
                      ) : (
                        completedJobs.map((job) => (
                          <div key={job.id} className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <FiCheckCircle className="text-purple-600" size={20} />
                                  <h4 className="text-lg font-semibold text-gray-900">{job.job_title}</h4>
                                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 flex items-center gap-1">
                                    <FiCheckCircle size={14} />
                                    Completed
                                  </span>
                                </div>
                                <div className="mb-3">
                                  <span className="text-sm text-gray-600">Amount Earned:</span>
                                  <p className="text-xl font-bold text-purple-600">Rs{job.agreed_amount?.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-white rounded-lg p-4 mb-4">
                              <h5 className="text-sm font-semibold text-gray-900 mb-2">Customer</h5>
                              <p className="text-sm text-gray-700">{job.customer_name}</p>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                              <FiCheckCircle size={16} className="text-green-600" />
                              <span>Completed {getTimeAgo(job.updated_at)}</span>
                            </div>

                            <div className="flex gap-3">
                              <Link href={`/jobs/${job.job_id}`}>
                                <button className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm">
                                  View Details
                                </button>
                              </Link>
                              <Link href={`/chat/${job.id}`}>
                                <button className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium text-sm flex items-center justify-center gap-2">
                                  <FiMessageSquare size={16} />
                                  View Chat History
                                </button>
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}