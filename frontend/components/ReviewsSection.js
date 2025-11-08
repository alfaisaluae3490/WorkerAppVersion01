// frontend/components/ReviewsSection.js
import { useState, useEffect } from 'react';
import apiClient from '../utils/apiClient';

export default function ReviewsSection({ userId, userType = 'worker' }) {
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all'); // all, 5, 4, 3, 2, 1

  useEffect(() => {
    fetchReviews();
  }, [userId]);

const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/reviews/user/${userId}`);
      
      console.log('📊 Reviews API Response:', response);
      
      if (response.success) {
        setReviews(response.data.reviews);
        setStats(response.data.stats);
      }
    } catch (err) {
      setError('Failed to load reviews');
      console.error('Fetch reviews error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  

  const getFilteredReviews = () => {
    if (selectedFilter === 'all') return reviews;
    return reviews.filter(r => r.rating === parseInt(selectedFilter));
  };

  const getRatingPercentage = (count) => {
    if (!stats || stats.total_reviews === 0) return 0;
    return ((count / stats.total_reviews) * 100).toFixed(0);
  };

  const StarDisplay = ({ rating, size = 'base' }) => {
    const sizeClasses = {
      sm: 'text-sm',
      base: 'text-base',
      lg: 'text-xl',
      xl: 'text-2xl'
    };

    return (
      <div className={`flex gap-0.5 ${sizeClasses[size]}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <p className="text-red-600 text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">Reviews & Ratings</h2>
        {stats && (
          <p className="text-sm text-gray-600 mt-1">
            {stats.total_reviews} {stats.total_reviews === 1 ? 'review' : 'reviews'}
          </p>
        )}
      </div>

      {/* Stats Overview */}
      {stats && stats.total_reviews > 0 && (
        <div className="grid md:grid-cols-2 gap-6 pb-6 border-b">
          {/* Overall Rating */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-gray-800">
                {stats.average_rating || '0.00'}
              </div>
              <StarDisplay rating={Math.round(parseFloat(stats.average_rating))} size="lg" />
              <p className="text-sm text-gray-600 mt-2">
                Based on {stats.total_reviews} reviews
              </p>
            </div>
          </div>

          {/* Rating Breakdown */}
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = parseInt(stats[`${['five', 'four', 'three', 'two', 'one'][5 - star]}_star`] || 0);
              const percentage = getRatingPercentage(count);
              
              return (
                <button
                  key={star}
                  onClick={() => setSelectedFilter(star.toString())}
                  className={`w-full flex items-center gap-3 hover:bg-gray-50 p-2 rounded transition-colors ${
                    selectedFilter === star.toString() ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className="text-sm font-medium text-gray-700 w-12">
                    {star} star
                  </span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {percentage}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {stats && stats.total_reviews > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All Reviews
          </button>
          {[5, 4, 3, 2, 1].map((star) => (
            <button
              key={star}
              onClick={() => setSelectedFilter(star.toString())}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedFilter === star.toString()
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {star} ★
            </button>
          ))}
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-4">
        {getFilteredReviews().length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <p className="text-gray-600 mt-4">
              {selectedFilter === 'all' 
                ? 'No reviews yet' 
                : `No ${selectedFilter}-star reviews`}
            </p>
          </div>
        ) : (
          getFilteredReviews().map((review) => (
            <div
              key={review.id}
              className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
            >
              {/* Reviewer Info */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={review.reviewer_picture || '/default-avatar.png'}
                      alt={review.reviewer_name}
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                    />
                    {review.is_verified && (
                      <div className="absolute -bottom-1 -right-1 bg-blue-600 rounded-full p-1">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {review.reviewer_name}
                      {review.is_verified && (
                        <span className="ml-2 text-xs text-blue-600 font-normal">
                          Verified
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-gray-500">{formatDate(review.created_at)}</p>
                  </div>
                </div>
                <StarDisplay rating={review.rating} size="base" />
              </div>

              {/* Job Title */}
              {review.job_title && (
                <div className="mb-3 text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                  <span className="font-medium">Job:</span> {review.job_title}
                </div>
              )}

              {/* Review Comment */}
              {review.comment && (
                <p className="text-gray-700 mb-3 leading-relaxed">{review.comment}</p>
              )}

              {/* Category Ratings */}
              {review.categories && Object.keys(review.categories).length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t">
                  {Object.entries(review.categories).map(([key, value]) => (
                    value > 0 && (
                      <div key={key} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 capitalize">
                          {key.replace('_', ' ')}:
                        </span>
                        <StarDisplay rating={value} size="sm" />
                      </div>
                    )
                  ))}
                </div>
              )}

              {/* Invoice Amount */}
              {review.invoice_amount && (
                <div className="flex items-center gap-2 text-sm text-gray-600 pt-3 border-t">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Job Amount: <strong>AED {parseFloat(review.invoice_amount).toFixed(2)}</strong></span>
				  
				  
				  
				
				  
				  
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Load More (if needed in future) */}
      {reviews.length >= 20 && (
        <div className="text-center pt-4">
          <button className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors">
            Load More Reviews
          </button>
        </div>
      )}
    </div>
  );
}