// frontend/components/CompletionModal.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function CompletionModal({ 
  bookingId, 
  isOpen, 
  onClose, 
  onSuccess,
  userType,
  completionStatus 
}) {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 = completion, 2 = review
  const [loading, setLoading] = useState(false);

  // Completion form state
  const [invoiceFile, setInvoiceFile] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(null);
  const [totalAmount, setTotalAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Review form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [categoryRatings, setCategoryRatings] = useState({
    quality: 0,
    punctuality: 0,
    communication: 0,
    professionalism: 0
  });

  // Determine initial step based on completion status
  useEffect(() => {
    if (completionStatus?.bothCompleted && !completionStatus?.userReviewSubmitted) {
      setStep(2); // Go directly to review if both completed
    } else {
      setStep(1); // Start with completion
    }
  }, [completionStatus]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setStep(1);
    setInvoiceFile(null);
    setInvoicePreview(null);
    setTotalAmount('');
    setNotes('');
    setRating(0);
    setHoverRating(0);
    setComment('');
    setCategoryRatings({
      quality: 0,
      punctuality: 0,
      communication: 0,
      professionalism: 0
    });
  };

  const handleInvoiceChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setInvoiceFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoicePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCompleteJob = async (e) => {
    e.preventDefault();

    if (!invoiceFile) {
      toast.error('Please upload an invoice');
      return;
    }

    if (!totalAmount || parseFloat(totalAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('invoice', invoiceFile);
      formData.append('bookingId', bookingId);
      formData.append('totalAmount', totalAmount);
      if (notes) formData.append('notes', notes);

      const response = await axios.post(
        `${API_URL}/reviews/complete-job`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        toast.success(response.data.message);
        
        // Check if both completed
        if (response.data.data.bothCompleted) {
          // Both completed - move to review step
          setStep(2);
        } else {
          // Only one completed - close modal and redirect
          onClose();
          if (onSuccess) onSuccess(response.data.message);
          router.push('/dashboard/customer');
        }
      }
    } catch (error) {
      console.error('Complete job error:', error);
      toast.error(error.response?.data?.message || 'Failed to mark job as complete');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      
      const reviewData = {
        bookingId,
        revieweeId: 'placeholder', // Backend will determine correct reviewee
        rating,
        comment: comment.trim(),
        categories: categoryRatings
      };

      const response = await axios.post(
        `${API_URL}/reviews/submit`,
        reviewData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        toast.success('Review submitted successfully!');
        
        // Close modal and redirect to dashboard
        onClose();
        resetForm();
        
        // Redirect based on user type
        const dashboardPath = userType === 'worker' ? '/dashboard/worker' : '/dashboard/customer';
        router.push(dashboardPath);
      }
    } catch (error) {
      console.error('Submit review error:', error);
      toast.error(error.response?.data?.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryRating = (category, value) => {
    setCategoryRatings(prev => ({
      ...prev,
      [category]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">
            {step === 1 ? 'Complete Job' : 'Submit Review'}
          </h2>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step 1: Mark as Complete */}
        {step === 1 && (
          <form onSubmit={handleCompleteJob} className="p-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Upload the invoice/receipt showing the final amount. Both you and the other party must complete this step before reviews can be submitted.
              </p>
            </div>

            {/* Invoice Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Invoice/Receipt <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleInvoiceChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
              {invoicePreview && (
                <div className="mt-4">
                  <img src={invoicePreview} alt="Invoice preview" className="max-w-xs rounded-lg border" />
                </div>
              )}
            </div>

            {/* Total Amount */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Amount (AED) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="120.00"
                required
              />
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional information..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  resetForm();
                }}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Mark as Complete'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Submit Review */}
        {step === 2 && (
          <form onSubmit={handleSubmitReview} className="p-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-green-800">
                <strong>✓ Job Completed!</strong> Both parties have marked this job as complete. Please submit your review.
              </p>
            </div>

            {/* Overall Rating */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Overall Rating <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="text-4xl focus:outline-none transition-transform hover:scale-110"
                  >
                    <span className={
                      star <= (hoverRating || rating)
                        ? 'text-yellow-400'
                        : 'text-gray-300'
                    }>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {rating === 0 && 'Click to rate'}
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </p>
            </div>

            {/* Category Ratings */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Detailed Ratings (Optional)
              </label>
              
              {Object.entries({
                quality: 'Quality of Work',
                punctuality: 'Punctuality',
                communication: 'Communication',
                professionalism: 'Professionalism'
              }).map(([key, label]) => (
                <div key={key} className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">{label}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleCategoryRating(key, star)}
                          className="text-xl focus:outline-none"
                        >
                          <span className={
                            star <= categoryRatings[key]
                              ? 'text-yellow-400'
                              : 'text-gray-300'
                          }>
                            ★
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Review (Optional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Share your experience..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
                disabled={loading || rating === 0}
              >
                {loading ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}