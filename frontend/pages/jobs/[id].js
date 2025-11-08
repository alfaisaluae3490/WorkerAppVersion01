// frontend/pages/jobs/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiMapPin, 
  FiDollarSign, 
  FiClock,
  FiCalendar,
  FiUser,
  FiStar,
  FiArrowLeft,
  FiAlertCircle,
  FiCheckCircle,
  FiMessageSquare,
  FiImage,
  FiLock
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { jobsAPI, bidsAPI } from '../../utils/apiClient';
import toast from 'react-hot-toast';
import ImageGallery from '../../components/ImageGallery';
export default function JobDetails() {
  const router = useRouter();
  const { id } = router.query;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showBidForm, setShowBidForm] = useState(false);
  const [submittingBid, setSubmittingBid] = useState(false);
  const [workerProfile, setWorkerProfile] = useState(null);
  const [cityMismatch, setCityMismatch] = useState(false);

  const [bidData, setBidData] = useState({
    amount: '',
    message: '',
    estimated_duration: '',
  });

  // Fetch job details
  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
  }, [id, user]);

  const fetchJobDetails = async () => {
    try {
      setLoading(true);
      setCityMismatch(false);
      
      let params = {};
      
      // If user is a worker, fetch profile first and add worker_city param
      if (user && (user.role === 'worker' || user.role === 'both')) {
        try {
          const profileResponse = await fetch('http://localhost:5000/api/profiles/worker/me', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.success && profileData.data.profile.city) {
              setWorkerProfile(profileData.data.profile);
              params.worker_city = profileData.data.profile.city;
            }
          }
        } catch (profileError) {
          console.error('Failed to fetch worker profile:', profileError);
        }
      }
      
      const response = await jobsAPI.getJob(id, params);
      
      if (response.success) {
        setJob(response.data.job);
      }
    } catch (error) {
      console.error('Failed to fetch job:', error);
      
      // Check if it's a city mismatch error
      if (error.response?.data?.city_mismatch) {
        setCityMismatch(true);
        toast.error(error.response.data.message || 'This job is not available in your city');
      } else {
        toast.error('Failed to load job details');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBidChange = (e) => {
    const { name, value } = e.target;
    setBidData({
      ...bidData,
      [name]: value
    });
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Please login to place a bid');
      router.push('/login');
      return;
    }

    // ✅ NEW: Check if job is completed
    if (job.status === 'completed') {
      toast.error('Cannot bid on completed jobs');
      return;
    }

    // ✅ NEW: Check if job is assigned
    if (job.status === 'assigned' || job.status === 'in_progress') {
      toast.error('This job has already been assigned');
      return;
    }

    // Validation
    if (!bidData.amount || parseFloat(bidData.amount) <= 0) {
      toast.error('Please enter a valid bid amount');
      return;
    }

    if (!bidData.message || bidData.message.length < 10) {
      toast.error('Please provide a message (min 10 characters)');
      return;
    }

    setSubmittingBid(true);

    try {
      // Call bids API
      const response = await bidsAPI.createBid({
        job_id: job.id,
        bid_amount: parseFloat(bidData.amount),
        proposal: bidData.message,
        estimated_duration: bidData.estimated_duration || null
      });

      if (response.success) {
        toast.success('Bid submitted successfully!');
        setShowBidForm(false);
        setBidData({ amount: '', message: '', estimated_duration: '' });
        // Refresh job to show new bid count
        fetchJobDetails();
      } else {
        toast.error(response.message || 'Failed to submit bid');
      }
    } catch (error) {
      console.error('Submit bid error:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to submit bid';
      toast.error(errorMessage);
    } finally {
      setSubmittingBid(false);
    }
  };

  // ✅ NEW: Check if job is completed
  const isJobCompleted = () => {
    return job?.status === 'completed';
  };

  // ✅ NEW: Check if job accepts bids
  const canPlaceBid = () => {
    if (!job) return false;
    return job.status === 'open' && !isOwnJob;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Job not found</p>
          <Link href="/browse-jobs">
            <button className="btn-primary">Browse Jobs</button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwnJob = user?.id === job.customer_id;

  return (
    <>
      <Head>
        <title>{job.title} - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link href="/">
                <h1 className="text-2xl font-bold text-primary-600 cursor-pointer">
                  Services Marketplace
                </h1>
              </Link>

              <div className="flex items-center gap-4">
                {isAuthenticated ? (
                  <>
                    <Link href="/dashboard/customer">
                      <button className="text-gray-700 hover:text-primary-600 font-medium">
                        Dashboard
                      </button>
                    </Link>
                    <Link href="/profile">
                      <button className="text-gray-700 hover:text-primary-600 font-medium">
                        Profile
                      </button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <button className="text-gray-700 hover:text-primary-600 font-medium">
                        Login
                      </button>
                    </Link>
                    <Link href="/signup">
                      <button className="btn-primary">
                        Sign Up
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">


       {/* Back Button */}
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
          >
            <FiArrowLeft />
            <span>Back</span>
          </button>

          {/* City Mismatch Warning */}
          {cityMismatch && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <FiAlertCircle className="text-red-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <p className="font-semibold text-red-800">Job Not Available in Your City</p>
                <p className="text-sm text-red-700">
                  This job is only available for workers in {job?.city || 'another city'}. 
                  You are registered in {workerProfile?.city || 'a different city'}.
                </p>
              </div>
            </div>
          )}

          {/* ✅ NEW: Job Completed Banner */}
          {isJobCompleted() && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <FiCheckCircle className="text-green-600 flex-shrink-0" size={24} />
              <div className="flex-1">
                <p className="font-semibold text-green-800">Job Completed</p>
                <p className="text-sm text-green-700">This job has been successfully completed by both parties.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Job Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Job Header */}
              <div className="card">
			  
			  
			  
			  
			  
			  
			  
			  
			  
			  
			  
			  
			  
			  <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
                    
                    {/* Location Info - Prominent */}
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div className="flex items-start gap-2 mb-2">
                        <FiMapPin className="text-blue-600 mt-1" size={18} />
                        <div>
                          <p className="text-xs font-semibold text-blue-900 uppercase mb-1">Complete Address</p>
                          <p className="text-sm font-medium text-gray-900">{job.location_address || job.address || 'Address not provided'}</p>
                          <p className="text-sm text-gray-700 mt-1">{job.city}, {job.province}</p>
                        </div>
                      </div>
                    </div>

                    {/* Preferred Date & Time - Prominent */}
                    {(job.preferred_date || job.preferred_time) && (
                      <div className="mb-3 p-3 bg-green-50 rounded-lg border border-green-100">
                        <div className="flex items-center gap-4">
                          {job.preferred_date && (
                            <div className="flex items-center gap-2">
                              <FiCalendar className="text-green-600" size={18} />
                              <div>
                                <p className="text-xs font-semibold text-green-900 uppercase">Preferred Date</p>
                                <p className="text-sm font-medium text-gray-900">{new Date(job.preferred_date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          )}
                          {job.preferred_time && (
                            <div className="flex items-center gap-2">
                              <FiClock className="text-green-600" size={18} />
                              <div>
                                <p className="text-xs font-semibold text-green-900 uppercase">Preferred Time</p>
                                <p className="text-sm font-medium text-gray-900">{job.preferred_time}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <FiCalendar size={16} />
                        <span>Posted {new Date(job.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <FiMessageSquare size={16} />
                        <span>{job.bids_count || 0} Bids</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    job.status === 'open' ? 'bg-green-100 text-green-800' :
                    job.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                    job.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </div>
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				
				

                {/* Budget */}
                <div className="bg-primary-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Budget Range</p>
                      <p className="text-2xl font-bold text-primary-600">
                        ₨{job.budget_min?.toLocaleString()} - ₨{job.budget_max?.toLocaleString()}
                      </p>
                    </div>
                    <FiDollarSign className="text-primary-600" size={40} />
                  </div>
                </div>

                {/* Category */}
                {job.category_name && (
                  <div className="mb-4">
                    <span className="inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                      {job.category_name}
                    </span>
                  </div>
                )}
              </div>

              {/* Job Description */}
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Job Description</h2>
                <p className="text-gray-700 whitespace-pre-line leading-relaxed">
                  {job.description}
                </p>
              </div>








          {/* Job Images */}
<ImageGallery images={job.images || []} />







              {/* Customer Info */}
              <div className="card">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Posted By</h2>
                
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    {job.customer_picture ? (
                      <img
                        src={job.customer_picture}
                        alt={job.customer_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <FiUser className="text-gray-500" size={32} />
                    )}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-gray-900">{job.customer_name}</h3>
                    <p className="text-sm text-gray-600">Customer</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Actions */}
            <div className="lg:col-span-1">
              <div className="space-y-4 sticky top-24">
			  
			  
			  
			  
                {/* Bid / Action Card */}
             {job.status === 'assigned' || job.status === 'in_progress' ? (
                  <div className="card">
                    <div className="text-center py-8">
                      {isOwnJob ? (
                        <>
                          <FiCheckCircle className="mx-auto text-green-600 mb-3" size={48} />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Job Assigned
                          </h3>
                          <p className="text-gray-600 mb-4">
                            Worker has been assigned to this job
                          </p>
                          {job.booking_id && (
                            <Link href={`/chat/${job.booking_id}`}>
                              <button className="btn-primary w-full flex items-center justify-center gap-2">
                                <FiMessageSquare size={18} />
                                Chat with Worker
                              </button>
                            </Link>
                          )}
                        </>
                      ) : (
                        <>
                          <FiCheckCircle className="mx-auto text-green-600 mb-3" size={48} />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Your Bid Was Accepted!
                          </h3>
                          <p className="text-gray-600 mb-4">
                            Congratulations! You can now chat with the customer.
                          </p>
                          {job.booking_id && (
                            <Link href={`/chat/${job.booking_id}`}>
                              <button className="btn-primary w-full flex items-center justify-center gap-2">
                                <FiMessageSquare size={18} />
                                Chat with Customer
                              </button>
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : !isOwnJob ? (
				
				
				
				
				
				
                  canPlaceBid() && !showBidForm ? (
                    <>
                      {cityMismatch ? (
                        <div className="card bg-red-50 border-red-200">
                          <FiAlertCircle className="mx-auto text-red-600 mb-3" size={48} />
                          <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                            City Restriction
                          </h3>
                          <p className="text-gray-600 text-center">
                            You can only bid on jobs in {workerProfile?.city || 'your registered city'}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!isAuthenticated) {
                              toast.error('Please login to place a bid');
                              router.push('/login');
                              return;
                            }
                            setShowBidForm(true);
                          }}
                          className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-semibold text-lg transition-colors"
                        >
                          Place Your Bid
                        </button>
                      )}
                    </>
                  ) : canPlaceBid() && showBidForm ? (
                    <div className="card">
                      <h3 className="font-semibold text-gray-900 mb-4">Submit Your Bid</h3>
                      
                      <form onSubmit={handleSubmitBid} className="space-y-4">
                        {/* Bid Amount */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Your Bid Amount (PKR) <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <FiDollarSign className="text-gray-400" size={18} />
                            </div>
                            <input
                              type="number"
                              name="amount"
                              value={bidData.amount}
                              onChange={handleBidChange}
                              className="input-field pl-10"
                              placeholder="Enter your bid"
                              required
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Budget: ₨{job.budget_min?.toLocaleString()} - ₨{job.budget_max?.toLocaleString()}
                          </p>
                        </div>

                        {/* Message */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Proposal Message <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            name="message"
                            value={bidData.message}
                            onChange={handleBidChange}
                            className="input-field min-h-[120px]"
                            placeholder="Explain why you're the best fit for this job..."
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            {bidData.message.length} characters (min 10)
                          </p>
                        </div>

                        {/* Estimated Duration */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Estimated Duration (Optional)
                          </label>
                          <input
                            type="text"
                            name="estimated_duration"
                            value={bidData.estimated_duration}
                            onChange={handleBidChange}
                            className="input-field"
                            placeholder="e.g., 2-3 hours, 1 day"
                          />
                        </div>

                        {/* Notice */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2">
                          <FiAlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={18} />
                          <p className="text-sm text-blue-800">
                            Your contact details will only be shared if the customer accepts your bid.
                          </p>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowBidForm(false)}
                            className="flex-1 btn-secondary"
                            disabled={submittingBid}
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 btn-primary"
                            disabled={submittingBid}
                          >
                            {submittingBid ? 'Submitting...' : 'Submit Bid'}
                          </button>
                        </div>
                      </form>
                    </div>
                  ) : null
                ) : (
                  <div className="card">
                    <div className="text-center py-8">
                      <FiCheckCircle className="mx-auto text-green-600 mb-3" size={48} />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        This is your job posting
                      </h3>
                      <p className="text-gray-600 mb-4">
                        You cannot bid on your own job
                      </p>
                      <Link href={`/jobs/${job.id}/bids`}>
                        <button className="btn-primary w-full">
                          View Bids
                        </button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Job Statistics */}
                <div className="card mt-4">
                  <h3 className="font-semibold text-gray-900 mb-4">Job Statistics</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total Bids</span>
                      <span className="font-semibold text-gray-900">{job.bids_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        job.status === 'open' ? 'bg-green-100 text-green-800' :
                        job.status === 'assigned' ? 'bg-yellow-100 text-yellow-800' :
                        job.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Posted</span>
                      <span className="font-semibold text-gray-900">
                        {new Date(job.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .card {
          @apply bg-white rounded-xl p-6 shadow-sm;
        }
        
        .btn-primary {
          @apply bg-primary-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed;
        }
        
        .btn-secondary {
          @apply border-2 border-gray-300 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50 disabled:cursor-not-allowed;
        }
        
        .input-field {
          @apply w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent;
        }
        
        .spinner {
          @apply w-12 h-12 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin;
        }
      `}</style>
    </>
  );
}