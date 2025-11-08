// frontend/pages/browse-jobs.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiSearch, 
  FiMapPin, 
  FiDollarSign, 
  FiClock,
  FiFilter,
  FiMessageSquare,
  FiCalendar,
  FiUser,
  FiX
} from 'react-icons/fi';
import useAuthStore from '../store/authStore';
import { jobsAPI, categoriesAPI } from '../utils/apiClient';
import toast from 'react-hot-toast';

export default function BrowseJobs() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [jobs, setJobs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [workerProfile, setWorkerProfile] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    category: '',
    city: '',
    province: '',
    min_budget: '',
    max_budget: '',
  });

  const provinces = [
    'Punjab', 'Sindh', 'Khyber Pakhtunkhwa', 'Balochistan',
    'Gilgit-Baltistan', 'Azad Kashmir', 'Islamabad Capital Territory'
  ];

  // Fetch jobs and categories on mount
  useEffect(() => {
    fetchCategories();
    if (user?.role === 'worker' || user?.role === 'both') {
      fetchWorkerProfileAndJobs();
    } else {
      fetchJobs();
    }
  }, [user]);

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories();
      if (response.success) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchWorkerProfileAndJobs = async () => {
    try {
      // Fetch worker profile first
      const profileResponse = await fetch('http://localhost:5000/api/profiles/worker/me', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.success) {
          setWorkerProfile(profileData.data.profile);
          // Fetch jobs filtered by worker's city AND worker's services
          await fetchJobs({ 
            worker_city: profileData.data.profile.city,
            worker_id: user.id // Pass worker_id to filter by service categories
          });
          return;
        }
      }
      // Fallback: fetch all jobs if profile fetch fails
      await fetchJobs();
    } catch (error) {
      console.error('Failed to fetch worker profile:', error);
      await fetchJobs();
    }
  };

  const fetchJobs = async (appliedFilters = {}) => {
    try {
      setLoading(true);
      const response = await jobsAPI.getJobs({
        status: 'open',
        ...appliedFilters
      });
      
      if (response.success) {
        setJobs(response.data.jobs);
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({
      ...filters,
      [name]: value
    });
  };

  const applyFilters = () => {
    const appliedFilters = {};
    
    // Always add worker_city and worker_id filters for workers
    if (workerProfile?.city && (user?.role === 'worker' || user?.role === 'both')) {
      appliedFilters.worker_city = workerProfile.city;
      appliedFilters.worker_id = user.id; // Add worker_id for service filtering
    }
    
    if (filters.category) appliedFilters.category = filters.category;
    if (filters.city) appliedFilters.city = filters.city;
    if (filters.province) appliedFilters.province = filters.province;
    if (filters.min_budget) appliedFilters.min_budget = filters.min_budget;
    if (filters.max_budget) appliedFilters.max_budget = filters.max_budget;

    fetchJobs(appliedFilters);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      city: '',
      province: '',
      min_budget: '',
      max_budget: '',
    });
    // Maintain city filter for workers
    if (workerProfile?.city && (user?.role === 'worker' || user?.role === 'both')) {
      fetchJobs({ worker_city: workerProfile.city });
    } else {
      fetchJobs();
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.city.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + ' years ago';
    
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + ' months ago';
    
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + ' days ago';
    
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + ' hours ago';
    
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + ' minutes ago';
    
    return 'Just now';
  };

  return (
    <>
      <Head>
        <title>Browse Jobs - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link href="/">
                <h1 className="text-2xl font-bold text-primary-600 cursor-pointer">
                  Services Marketplace
                </h1>
              </Link>
              
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/browse-jobs" className="text-primary-600 font-semibold">
                  Browse Jobs
                </Link>
                <Link href="/my-bids" className="text-gray-700 hover:text-primary-600">
                  My Bids
                </Link>
                <Link href="/messages" className="text-gray-700 hover:text-primary-600">
                  Messages
                </Link>
              </nav>

              <div className="flex items-center gap-4">
                {isAuthenticated ? (
                  <Link href="/dashboard/worker">
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <FiUser size={18} />
                      <span>Dashboard</span>
                    </button>
                  </Link>
                ) : (
                  <Link href="/login">
                    <button className="btn-primary">Login</button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Browse Available Jobs
            </h1>
            <p className="text-gray-600">
              Find your next opportunity and place competitive bids
            </p>
          </div>

          {/* Search and Filter Bar */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search Input */}
              <div className="flex-1 relative">
                <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="Search jobs by title, description, or location..."
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="btn-outline flex items-center justify-center gap-2 md:w-auto"
              >
                <FiFilter size={20} />
                <span>Filters</span>
              </button>

              {/* Apply Search */}
              <button
                onClick={() => fetchJobs()}
                className="btn-primary md:w-auto"
              >
                Search
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="mt-6 pt-6 border-t grid md:grid-cols-3 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    name="category"
                    value={filters.category}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.slug} value={cat.slug}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* City */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={filters.city}
                    onChange={handleFilterChange}
                    placeholder="Enter city"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Province */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Province
                  </label>
                  <select
                    name="province"
                    value={filters.province}
                    onChange={handleFilterChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">All Provinces</option>
                    {provinces.map((prov) => (
                      <option key={prov} value={prov}>{prov}</option>
                    ))}
                  </select>
                </div>

                {/* Budget Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Budget (PKR)
                  </label>
                  <input
                    type="number"
                    name="min_budget"
                    value={filters.min_budget}
                    onChange={handleFilterChange}
                    placeholder="e.g., 5000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Budget (PKR)
                  </label>
                  <input
                    type="number"
                    name="max_budget"
                    value={filters.max_budget}
                    onChange={handleFilterChange}
                    placeholder="e.g., 20000"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                {/* Filter Actions */}
                <div className="flex items-end gap-2">
                  <button
                    onClick={applyFilters}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
                  >
                    Apply
                  </button>
                  <button
                    onClick={clearFilters}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-medium"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Results Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-gray-600">
              <span className="font-semibold text-gray-900">{filteredJobs.length}</span> jobs found
            </p>
            <select className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              <option>Sort by: Latest</option>
              <option>Budget: Low to High</option>
              <option>Budget: High to Low</option>
              <option>Most Bids</option>
            </select>
          </div>

          {/* Jobs List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="spinner"></div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-20">
              <FiSearch className="mx-auto text-gray-400 mb-4" size={64} />
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                No jobs found
              </h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or search terms
              </p>
              <button
                onClick={clearFilters}
                className="btn-primary"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer"
                  onClick={() => router.push(`/jobs/${job.id}`)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900 hover:text-primary-600">
                          {job.title}
                        </h3>
                        {job.category_name && (
                          <span className="badge badge-info text-xs">
                            {job.category_name}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-gray-600 mb-3 line-clamp-2">
                        {job.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <FiMapPin size={16} className="text-primary-600" />
                          {job.city}, {job.province}
                        </span>
                        
                        <span className="flex items-center gap-1">
                          <FiDollarSign size={16} className="text-green-600" />
                          ₨{job.budget_min?.toLocaleString()} - ₨{job.budget_max?.toLocaleString()}
                        </span>
                        
                        <span className="flex items-center gap-1">
                          <FiClock size={16} className="text-gray-400" />
                          {getTimeAgo(job.created_at)}
                        </span>

                        {job.bids_count > 0 && (
                          <span className="flex items-center gap-1">
                            <FiMessageSquare size={16} className="text-blue-600" />
                            {job.bids_count} {job.bids_count === 1 ? 'bid' : 'bids'}
                          </span>
                        )}

                        {job.preferred_date && (
                          <span className="flex items-center gap-1">
                            <FiCalendar size={16} className="text-purple-600" />
                            {new Date(job.preferred_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/jobs/${job.id}`);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ml-4"
                    >
                      Place Bid
                    </button>
                  </div>

                  {/* Job Images Preview */}
                  {job.images && (() => {
                    try {
                      const images = typeof job.images === 'string' ? JSON.parse(job.images) : job.images;
                      return Array.isArray(images) && images.length > 0 ? (
                        <div className="flex gap-2 mt-4">
                          {images.slice(0, 3).map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt={`Job ${idx + 1}`}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          ))}
                          {images.length > 3 && (
                            <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 text-sm font-medium">
                              +{images.length - 3}
                            </div>
                          )}
                        </div>
                      ) : null;
                    } catch (e) {
                      return null;
                    }
                  })()}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}