// frontend/pages/jobs/[id]/bids.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { 
  FiArrowLeft, 
  FiDollarSign, 
  FiClock,
  FiStar,
  FiCheck,
  FiX,
  FiUser,
  FiBriefcase,
  FiAward,
  FiMapPin,
  FiMessageSquare,
  FiExternalLink
} from 'react-icons/fi';
import { jobsAPI, bidsAPI } from '../../../utils/apiClient';

export default function ViewBids() {
  const router = useRouter();
  const { id } = router.query;

  const [job, setJob] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingBidId, setProcessingBidId] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (id) {
      fetchJobAndBids();
    }
  }, [id]);

  const fetchJobAndBids = async () => {
    try {
      setLoading(true);

      const jobResponse = await jobsAPI.getJob(id);
      if (jobResponse.success) {
        setJob(jobResponse.data.job);
      }

      const bidsResponse = await bidsAPI.getJobBids(id);
      if (bidsResponse.success) {
        const bidsArray = bidsResponse.data.bids || bidsResponse.data || [];
        setBids(Array.isArray(bidsArray) ? bidsArray : []);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBid = async (bidId) => {
    if (!confirm('Are you sure you want to accept this bid? This will reject all other bids.')) {
      return;
    }

    try {
      setProcessingBidId(bidId);
      const response = await bidsAPI.acceptBid(bidId);
      
      if (response.success) {
        toast.success('Bid accepted successfully!');
        fetchJobAndBids();
      } else {
        toast.error(response.message || 'Failed to accept bid');
      }
    } catch (error) {
      console.error('Accept bid error:', error);
      toast.error('Failed to accept bid');
    } finally {
      setProcessingBidId(null);
    }
  };

  const handleRejectBid = async (bidId) => {
    if (!confirm('Are you sure you want to reject this bid?')) {
      return;
    }

    try {
      setProcessingBidId(bidId);
      const response = await bidsAPI.rejectBid(bidId);
      
      if (response.success) {
        toast.success('Bid rejected successfully');
        fetchJobAndBids();
      } else {
        toast.error(response.message || 'Failed to reject bid');
      }
    } catch (error) {
      console.error('Reject bid error:', error);
      toast.error('Failed to reject bid');
    } finally {
      setProcessingBidId(null);
    }
  };

  const filteredBids = bids.filter(bid => {
    switch (filter) {
      case 'pending':
        return bid.status === 'pending';
      case 'accepted':
        return bid.status === 'accepted';
      case 'rejected':
        return bid.status === 'rejected';
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bids...</p>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Job not found</p>
          <button
            onClick={() => router.push('/dashboard/customer')}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Bids for {job.title} | Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => router.back()}
            className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <FiArrowLeft />
            <span>Back</span>
          </button>

          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{job.title}</h1>
                <p className="text-gray-600 mb-4">{job.description}</p>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-700">
                    <FiMapPin className="text-blue-600" />
                    <span>{job.city}, {job.province}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <FiDollarSign className="text-green-600" />
                    <span>Rs{job.budget_min} - Rs{job.budget_max}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-700">
                    <FiBriefcase className="text-purple-600" />
                    <span>{job.category_name || 'General'}</span>
                  </div>
                </div>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                job.status === 'open' ? 'bg-green-100 text-green-800' :
                job.status === 'assigned' ? 'bg-blue-100 text-blue-800' :
                job.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {job.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  Bids Received ({bids.length})
                </h2>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      filter === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All ({bids.length})
                  </button>
                  <button
                    onClick={() => setFilter('pending')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      filter === 'pending'
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Pending ({bids.filter(b => b.status === 'pending').length})
                  </button>
                  <button
                    onClick={() => setFilter('accepted')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      filter === 'accepted'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Accepted ({bids.filter(b => b.status === 'accepted').length})
                  </button>
                  <button
                    onClick={() => setFilter('rejected')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      filter === 'rejected'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Rejected ({bids.filter(b => b.status === 'rejected').length})
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6">
              {filteredBids.length === 0 ? (
                <div className="text-center py-12">
                  <FiBriefcase className="mx-auto text-gray-400 mb-4" size={48} />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No bids yet
                  </h3>
                  <p className="text-gray-600">
                    {filter === 'all' 
                      ? 'Your job posting will appear to workers soon. Check back later!'
                      : `No ${filter} bids found.`}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBids.map((bid) => (
                    <div
                      key={bid.id}
                      className={`border rounded-lg p-6 ${
                        bid.status === 'accepted' ? 'border-green-300 bg-green-50' :
                        bid.status === 'rejected' ? 'border-red-300 bg-red-50' :
                        'border-gray-200 hover:border-blue-300'
                      } transition`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                            {bid.worker_picture ? (
                              <img 
                                src={bid.worker_picture} 
                                alt={bid.worker_name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              bid.worker_name.charAt(0).toUpperCase()
                            )}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-bold text-gray-900">{bid.worker_name}</h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                bid.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                bid.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {bid.status.toUpperCase()}
                              </span>
                            </div>
                            
                            {/* Worker Profile Stats */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <FiMapPin className="text-blue-600" size={16} />
                                  <div>
                                    <p className="text-gray-500 text-xs">Location</p>
                                    <p className="font-semibold text-gray-800">
                                      {bid.worker_city || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiStar className="text-yellow-500" size={16} />
                                  <div>
                                    <p className="text-gray-500 text-xs">Rating</p>
                                    <p className="font-semibold text-gray-800">
                                      {bid.worker_rating || '0.00'} ⭐
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiMessageSquare className="text-purple-600" size={16} />
                                  <div>
                                    <p className="text-gray-500 text-xs">Reviews</p>
                                    <p className="font-semibold text-gray-800">
                                      {bid.worker_reviews || 0}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <FiAward className="text-green-600" size={16} />
                                  <div>
                                    <p className="text-gray-500 text-xs">Jobs Done</p>
                                    <p className="font-semibold text-gray-800">
                                      {bid.worker_jobs_completed || 0}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                           {/* View Full Profile Link */}
                            <button
                                onClick={() => router.push(`/worker/${bid.worker_profile_id}`)}
                                className="mt-2 inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                              >
                                View Full Profile <FiExternalLink size={14} />
                              </button>
                            </div>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                              <span className="flex items-center gap-1">
                                <FiClock size={14} />
                                {new Date(bid.created_at).toLocaleDateString()}
                              </span>
                            </div>
							

                            <div className="mb-4">
                              <p className="text-gray-700 mb-2"><strong>Proposal:</strong></p>
                              <p className="text-gray-600 bg-white rounded-lg p-3 border border-gray-200">
                                {bid.message}
                              </p>
                            </div>

                            {bid.estimated_duration && (
                              <p className="text-sm text-gray-600 mb-2">
                                <strong>Estimated Duration:</strong> {bid.estimated_duration}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-sm text-gray-600 mb-1">Bid Amount</p>
                          <p className="text-3xl font-bold text-blue-600">Rs{bid.amount}</p>
                        </div>
                      </div>

                      {bid.status === 'pending' && job.status === 'open' && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleAcceptBid(bid.id)}
                            disabled={processingBidId === bid.id}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <FiCheck size={20} />
                            <span>{processingBidId === bid.id ? 'Accepting...' : 'Accept Bid'}</span>
                          </button>
                          <button
                            onClick={() => handleRejectBid(bid.id)}
                            disabled={processingBidId === bid.id}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                          >
                            <FiX size={20} />
                            <span>{processingBidId === bid.id ? 'Rejecting...' : 'Reject Bid'}</span>
                          </button>
                        </div>
                      )}

                      {bid.status === 'accepted' && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="text-center mb-3">
                            <p className="text-green-800 font-medium">✓ You accepted this bid</p>
                            <p className="text-sm text-green-600 mt-1">
                              A booking has been created. Contact the worker to discuss the project.
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              if (job.booking_id) {
                                router.push(`/chat/${job.booking_id}`);
                              } else {
                                toast.error('Booking not found. Please refresh the page.');
                              }
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2"
                          >
                            <FiMessageSquare size={20} />
                            Contact Worker
                          </button>
                        </div>
                      )}

                      {bid.status === 'rejected' && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                          <p className="text-red-800">You rejected this bid</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}