// frontend/pages/chat/[bookingId].js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FiSend, FiArrowLeft, FiUser, FiCheck, FiCheckCircle, FiLock, FiFlag } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import CompletionModal from '../../components/CompletionModal';

export default function ChatPage() {
  const router = useRouter();
  const { bookingId } = router.query;
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [booking, setBooking] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [completionStatus, setCompletionStatus] = useState(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportData, setReportData] = useState({ title: '', reason: '', description: '' });
  const [reportImages, setReportImages] = useState([]);
  const [submittingReport, setSubmittingReport] = useState(false);
  const messagesEndRef = useRef(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Fetch booking details and messages
  useEffect(() => {
    if (bookingId && user) {
      fetchBookingAndMessages();
      fetchCompletionStatus();
      // Poll for new messages every 3 seconds
      const interval = setInterval(() => {
        fetchMessages();
        fetchCompletionStatus();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [bookingId, user]);

  // Auto scroll to bottom
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchBookingAndMessages = async () => {
    try {
      setLoading(true);
      
      // Fetch booking details
      const bookingResponse = await fetch(`http://localhost:5000/api/bookings/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (bookingResponse.ok) {
        const bookingData = await bookingResponse.json();
        if (bookingData.success) {
          setBooking(bookingData.data.booking);
          
          // Determine other user
          const isCustomer = user.id === bookingData.data.booking.customer_id;
          setOtherUser({
            name: isCustomer ? bookingData.data.booking.worker_name : bookingData.data.booking.customer_name,
            role: isCustomer ? 'Worker' : 'Customer'
          });
        }
      }

      // Fetch messages
      await fetchMessages();
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMessages(data.data.messages || []);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const fetchCompletionStatus = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/reviews/completion-status/${bookingId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCompletionStatus(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching completion status:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      
      const response = await fetch('http://localhost:5000/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          bookingId: bookingId,
          message: newMessage.trim()
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNewMessage('');
          await fetchMessages();
        } else {
          toast.error(data.message || 'Failed to send message');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleCompletionSuccess = (message) => {
    toast.success(message);
    fetchCompletionStatus();
    fetchBookingAndMessages();
  };












const handleSubmitReport = async () => {
    if (!reportData.title || !reportData.reason || !reportData.description) {
      toast.error('Please fill all required fields');
      return;
    }

    if (!booking) {
      toast.error('Booking information not available');
      return;
    }

    try {
      setSubmittingReport(true);
      const formData = new FormData();
      
      const isCustomer = user.id === booking.customer_id;
      const reportedUserId = isCustomer ? booking.worker_user_id : booking.customer_id;
      
      console.log('🔍 Debug Report Data:', {
        isCustomer,
        userId: user.id,
        customerId: booking.customer_id,
        workerUserId: booking.worker_user_id,
        reportedUserId
      });

      if (!reportedUserId) {
        toast.error('Unable to identify user to report. Please try again.');
        console.error('Missing reported user ID:', booking);
        setSubmittingReport(false);
        return;
      }
      
      formData.append('reported_id', reportedUserId);
      formData.append('reported_type', 'user');
      formData.append('title', reportData.title);
      formData.append('reason', reportData.reason);
      formData.append('description', reportData.description);
      console.log('📤 Submitting report with:', {
        reported_id: reportedUserId,
        reported_type: 'user',
        title: reportData.title,
        reason: reportData.reason,
        imageCount: reportImages.length,
        images: reportImages.map(img => ({ name: img.name, size: img.size, type: img.type }))
      });
     console.log('📤 Submitting report with images:', {
        imageCount: reportImages.length,
        images: reportImages.map(img => ({ name: img.name, size: img.size, type: img.type }))
      });
      
      reportImages.forEach((image) => {
        formData.append('images', image);
        console.log('📎 Appending image:', { name: image.name, size: image.size, type: image.type });
      });

      const response = await fetch('http://localhost:5000/api/reports/create', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Report submitted successfully');
        setShowReportModal(false);
        setReportData({ title: '', reason: '', description: '' });
        setReportImages([]);
      } else {
        toast.error(data.message || 'Failed to submit report');
      }
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Failed to submit report');
    } finally {
      setSubmittingReport(false);
    }
  };
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  

  const getUserType = () => {
    if (!booking || !user) return null;
    return booking.customer_id === user.id ? 'customer' : 'worker';
  };

  const canMarkComplete = () => {
    if (!completionStatus || !booking) return false;
    const validStatuses = ['in_progress', 'confirmed'];
    return validStatuses.includes(booking.status) && !completionStatus.userMarkedComplete;
  };

  // ✅ NEW: Check if chat is locked (job completed)
  const isChatLocked = () => {
    if (!booking || !completionStatus) return false;
    return booking.status === 'completed' || completionStatus.bothCompleted;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Booking not found</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Chat - {otherUser?.name} | Services Marketplace</title>
      </Head>

      <div className="flex flex-col h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-4 py-4 shadow-sm">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <FiArrowLeft size={20} />
            </button>
            
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                  {otherUser?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">{otherUser?.name}</h1>
                  <p className="text-sm text-gray-500">{otherUser?.role}</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowReportModal(true)}
              className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition flex items-center gap-2"
              title="Report User"
            >
              <FiFlag size={20} />
            </button>

            {booking && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Job: {booking.job_title}</p>
                <p className="text-sm font-semibold text-green-600">AED {booking.agreed_amount}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  booking.status === 'completed' ? 'bg-green-100 text-green-700' :
                  booking.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {booking.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ✅ NEW: Job Completed Banner */}
        {isChatLocked() && (
          <div className="max-w-4xl mx-auto w-full px-4 mt-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <FiCheckCircle className="text-green-600" size={24} />
              <div className="flex-1">
                <p className="font-semibold text-green-800">Job Completed</p>
                <p className="text-sm text-green-700">This chat is now closed. Both parties have confirmed completion.</p>
              </div>
              <FiLock className="text-green-600" size={20} />
            </div>
          </div>
        )}

        {/* Completion Status Banner */}
        {completionStatus && !isChatLocked() && (
          <div className="max-w-4xl mx-auto w-full px-4 mt-4">
            {completionStatus.userMarkedComplete && !completionStatus.otherPartyMarkedComplete ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
                <FiCheck className="text-blue-600" size={24} />
                <div>
                  <p className="font-semibold text-blue-800">Waiting for Confirmation</p>
                  <p className="text-sm text-blue-700">You marked complete. Waiting for other party.</p>
                </div>
              </div>
            ) : completionStatus.otherPartyMarkedComplete && !completionStatus.userMarkedComplete ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FiCheck className="text-yellow-600" size={24} />
                  <div>
                    <p className="font-semibold text-yellow-800">Completion Request Received</p>
                    <p className="text-sm text-yellow-700">Other party marked complete. Please review.</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCompletionModal(true)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors whitespace-nowrap"
                >
                  Review & Confirm
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                  <FiUser size={32} className="text-gray-400" />
                </div>
                <p className="text-gray-500">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMyMessage = msg.sender_id === user.id;
                
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl ${
                        isMyMessage
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-200'
                      }`}
                    >
                      <p className="text-sm md:text-base break-words">{msg.message}</p>
                      <div className={`flex items-center gap-2 mt-2 text-xs ${
                        isMyMessage ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {isMyMessage && (
                          msg.is_read ? (
                            <FiCheckCircle size={14} className="text-blue-200" />
                          ) : (
                            <FiCheck size={14} className="text-blue-200" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Complete Job Button */}
        {canMarkComplete() && !isChatLocked() && (
          <div className="max-w-4xl mx-auto w-full px-4 pb-4">
            <button
              onClick={() => setShowCompletionModal(true)}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <FiCheckCircle size={20} />
              Mark Job as Complete
            </button>
          </div>
        )}

        {/* Input - ✅ DISABLED when chat locked */}
        <div className="bg-white border-t px-4 py-4">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            {isChatLocked() ? (
              <div className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 rounded-lg text-gray-600">
                <FiLock size={18} />
                <span className="font-medium">Chat closed - Job completed</span>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                >
                  {sending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <FiSend size={18} />
                      Send
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Completion Modal */}
      <CompletionModal
        bookingId={bookingId}
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        onSuccess={handleCompletionSuccess}
        userType={getUserType()}
        completionStatus={completionStatus}
      />

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Report {otherUser?.name}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={reportData.title}
                  onChange={(e) => setReportData({ ...reportData, title: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Brief title of the issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <select
                  value={reportData.reason}
                  onChange={(e) => setReportData({ ...reportData, reason: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">Select a reason</option>
                  <option value="inappropriate_behavior">Inappropriate Behavior</option>
                  <option value="spam">Spam</option>
                  <option value="fraud">Fraud/Scam</option>
                  <option value="harassment">Harassment</option>
                  <option value="fake_profile">Fake Profile</option>
                  <option value="poor_service">Poor Service Quality</option>
                  <option value="payment_issue">Payment Issue</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea
                  value={reportData.description}
                  onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 min-h-[100px] focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Provide detailed information about the issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Upload Evidence (Optional)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setReportImages(Array.from(e.target.files))}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                />
                {reportImages.length > 0 && (
                  <p className="text-xs text-gray-600 mt-1">{reportImages.length} image(s) selected</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportData({ title: '', reason: '', description: '' });
                  setReportImages([]);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                disabled={submittingReport}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReport}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                disabled={submittingReport}
              >
                {submittingReport ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}