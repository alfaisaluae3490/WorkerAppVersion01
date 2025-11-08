// frontend/components/BidCard.js
import { useState } from 'react';
import { FiUser, FiDollarSign, FiClock, FiMapPin, FiStar, FiCheck, FiX, FiAlertCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { bidsAPI } from '../utils/apiClient';

export default function BidCard({ bid, onBidUpdate, showActions = true }) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(null); // 'accept' or 'reject'

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-100 text-gray-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <FiClock className="mr-1" />,
      accepted: <FiCheck className="mr-1" />,
      rejected: <FiX className="mr-1" />,
      withdrawn: <FiAlertCircle className="mr-1" />,
    };
    return icons[status] || <FiClock className="mr-1" />;
  };

  const handleAcceptBid = async () => {
    setLoading(true);
    try {
      const response = await bidsAPI.acceptBid(bid.id);
      if (response.data.success) {
        toast.success('Bid accepted successfully! 🎉');
        setShowConfirm(null);
        if (onBidUpdate) onBidUpdate();
      }
    } catch (error) {
      console.error('Accept bid error:', error);
      toast.error(error.response?.data?.message || 'Failed to accept bid');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectBid = async () => {
    setLoading(true);
    try {
      const response = await bidsAPI.rejectBid(bid.id);
      if (response.data.success) {
        toast.success('Bid rejected');
        setShowConfirm(null);
        if (onBidUpdate) onBidUpdate();
      }
    } catch (error) {
      console.error('Reject bid error:', error);
      toast.error(error.response?.data?.message || 'Failed to reject bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      {/* Worker Info */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-4">
          {/* Avatar */}
          <div className="relative">
            {bid.worker_picture ? (
              <img
                src={bid.worker_picture}
                alt={bid.worker_name}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <span className="text-white text-2xl font-bold">
                  {bid.worker_name?.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {bid.status === 'accepted' && (
              <div className="absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-1">
                <FiCheck size={12} />
              </div>
            )}
          </div>

          {/* Worker Details */}
          <div>
            <h3 className="text-lg font-bold text-gray-900">{bid.worker_name}</h3>
            <div className="flex items-center space-x-3 text-sm text-gray-600 mt-1">
              {bid.worker_rating > 0 && (
                <div className="flex items-center">
                  <FiStar className="text-yellow-500 mr-1" size={14} />
                  <span className="font-semibold">{bid.worker_rating.toFixed(1)}</span>
                  <span className="ml-1">({bid.total_reviews || 0})</span>
                </div>
              )}
              {bid.worker_completed_jobs > 0 && (
                <div className="flex items-center">
                  <FiCheck className="text-green-500 mr-1" size={14} />
                  <span>{bid.worker_completed_jobs} jobs completed</span>
                </div>
              )}
            </div>
            {bid.location_city && (
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <FiMapPin className="mr-1" size={14} />
                <span>{bid.location_city}, {bid.location_province}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center ${getStatusBadge(bid.status)}`}>
          {getStatusIcon(bid.status)}
          {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
        </div>
      </div>

      {/* Bid Amount */}
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Bid Amount</p>
            <div className="flex items-center">
              <FiDollarSign className="text-blue-600 mr-1" size={20} />
              <span className="text-2xl font-bold text-blue-600">Rs{bid.amount}</span>
            </div>
          </div>
          {bid.estimated_duration && (
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">Estimated Time</p>
              <div className="flex items-center justify-end">
                <FiClock className="text-gray-600 mr-1" size={16} />
                <span className="text-sm font-semibold text-gray-900">{bid.estimated_duration}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Proposal Message */}
      <div className="mb-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">Proposal:</p>
        <p className="text-gray-700 text-sm leading-relaxed">{bid.message}</p>
      </div>

      {/* Worker Bio */}
      {bid.worker_bio && (
        <div className="mb-4 pb-4 border-b">
          <p className="text-sm font-semibold text-gray-700 mb-2">About the Worker:</p>
          <p className="text-gray-600 text-sm">{bid.worker_bio}</p>
        </div>
      )}

      {/* Hourly Rate */}
      {bid.hourly_rate && (
        <div className="text-sm text-gray-600 mb-4">
          <span className="font-semibold">Hourly Rate:</span> Rs{bid.hourly_rate}/hr
        </div>
      )}

      {/* Action Buttons */}
      {showActions && bid.status === 'pending' && !showConfirm && (
        <div className="flex space-x-3">
          <button
            onClick={() => setShowConfirm('accept')}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
          >
            <FiCheck className="mr-2" />
            Accept Bid
          </button>
          <button
            onClick={() => setShowConfirm('reject')}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center"
          >
            <FiX className="mr-2" />
            Reject
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-4">
          <div className="flex items-start space-x-3 mb-4">
            <FiAlertCircle className={`${showConfirm === 'accept' ? 'text-green-600' : 'text-red-600'} mt-1`} size={24} />
            <div>
              <h4 className="font-bold text-gray-900 mb-1">
                {showConfirm === 'accept' ? 'Accept this bid?' : 'Reject this bid?'}
              </h4>
              <p className="text-sm text-gray-600">
                {showConfirm === 'accept'
                  ? 'This will accept the bid and notify the worker. All other pending bids will be automatically rejected.'
                  : 'This will reject the bid and notify the worker. This action cannot be undone.'}
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={showConfirm === 'accept' ? handleAcceptBid : handleRejectBid}
              disabled={loading}
              className={`flex-1 ${
                showConfirm === 'accept' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
              } text-white py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? 'Processing...' : `Yes, ${showConfirm === 'accept' ? 'Accept' : 'Reject'}`}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              disabled={loading}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Accepted/Rejected Message */}
      {bid.status === 'accepted' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center">
          <FiCheck className="text-green-600 mr-2" size={20} />
          <p className="text-sm text-green-800 font-semibold">
            You accepted this bid. The worker has been notified.
          </p>
        </div>
      )}

      {bid.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center">
          <FiX className="text-red-600 mr-2" size={20} />
          <p className="text-sm text-red-800 font-semibold">
            You rejected this bid. The worker has been notified.
          </p>
        </div>
      )}

      {/* Bid Timestamp */}
      <div className="text-xs text-gray-500 mt-4 text-right">
        Placed on {new Date(bid.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}