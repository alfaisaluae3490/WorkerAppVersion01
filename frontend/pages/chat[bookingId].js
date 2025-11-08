// frontend/pages/chat/[bookingId].js
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiArrowLeft, 
  FiSend, 
  FiPaperclip,
  FiUser,
  FiLogOut,
  FiX,
  FiImage,
  FiFileText,
  FiAlertTriangle,
  FiPhone,
  FiMail,
  FiBriefcase,
  FiMapPin,
  FiDollarSign
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import { messagesAPI } from '../../utils/apiClient';
import toast from 'react-hot-toast';
import NotificationBell from '../../components/NotificationBell';

export default function ChatPage() {
  const router = useRouter();
  const { bookingId } = router.query;
  const { user, isAuthenticated, logout } = useAuthStore();
  
  const [messages, setMessages] = useState([]);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showBookingDetails, setShowBookingDetails] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else if (bookingId) {
      fetchMessages();
      fetchBookingInfo();
      
      // Poll for new messages every 5 seconds
      const interval = setInterval(() => {
        fetchMessages(true); // silent refresh
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, bookingId, router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const response = await messagesAPI.getMessages(bookingId);
      
      if (response.success) {
        setMessages(response.data.messages || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      if (!silent) {
        toast.error('Failed to load messages');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchBookingInfo = async () => {
    try {
      const response = await messagesAPI.getBookingInfo(bookingId);
      
      if (response.success) {
        setBookingInfo(response.data.booking);
      }
    } catch (error) {
      console.error('Error fetching booking info:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() && !selectedFile) {
      return;
    }

    try {
      setSending(true);
      
      const messageData = {
        booking_id: bookingId,
        message: newMessage.trim(),
      };

      if (selectedFile) {
        messageData.attachment = selectedFile;
      }

      const response = await messagesAPI.sendMessage(messageData);
      
      if (response.success) {
        setNewMessage('');
        setSelectedFile(null);
        await fetchMessages(true);
        scrollToBottom();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      setSelectedFile(file);
      toast.success('File selected: ' + file.name);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    }
  };

  const getOtherParticipant = () => {
    if (!bookingInfo) return null;
    
    if (user.id === bookingInfo.customer_id) {
      return {
        id: bookingInfo.worker_id,
        name: bookingInfo.worker_name,
        email: bookingInfo.worker_email,
        phone: bookingInfo.worker_phone,
        picture: bookingInfo.worker_picture,
        role: 'Worker'
      };
    } else {
      return {
        id: bookingInfo.customer_id,
        name: bookingInfo.customer_name,
        email: bookingInfo.customer_email,
        phone: bookingInfo.customer_phone,
        picture: bookingInfo.customer_picture,
        role: 'Customer'
      };
    }
  };

  const renderAttachment = (attachments) => {
    if (!attachments || attachments.length === 0) return null;
    
    const attachment = typeof attachments === 'string' ? JSON.parse(attachments)[0] : attachments[0];
    
    if (!attachment) return null;

    const isImage = attachment.match(/\.(jpg|jpeg|png|gif|webp)$/i);
    
    if (isImage) {
      return (
        <img 
          src={attachment} 
          alt="Attachment" 
          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition"
          onClick={() => window.open(attachment, '_blank')}
        />
      );
    } else {
      return (
        <a 
          href={attachment} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-lg hover:bg-gray-200 transition"
        >
          <FiFileText size={20} />
          <span className="text-sm">View Attachment</span>
        </a>
      );
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const otherParticipant = getOtherParticipant();

  return (
    <>
      <Head>
        <title>Chat - {otherParticipant?.name || 'Loading...'}</title>
      </Head>

      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm z-10 flex-shrink-0">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Left - Back button and chat info */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <button
                  onClick={() => router.push('/messages')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <FiArrowLeft size={20} />
                </button>
                
                {loading ? (
                  <div className="h-10 w-10 bg-gray-200 rounded-full animate-pulse"></div>
                ) : otherParticipant && (
                  <>
                    {otherParticipant.picture ? (
                      <img
                        src={otherParticipant.picture}
                        alt={otherParticipant.name}
                        className="w-10 h-10 rounded-full object-cover cursor-pointer"
                        onClick={() => setShowBookingDetails(true)}
                      />
                    ) : (
                      <div 
                        className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold cursor-pointer"
                        onClick={() => setShowBookingDetails(true)}
                      >
                        {otherParticipant.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 
                        className="font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                        onClick={() => setShowBookingDetails(true)}
                      >
                        {otherParticipant.name}
                      </h2>
                      <p className="text-xs text-gray-500">{otherParticipant.role}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Right side */}
              <div className="flex items-center gap-4">
                {/* Notification Bell */}
                <NotificationBell />

                {/* Profile Dropdown */}
                <div className="relative profile-dropdown">
                  <button 
                    onClick={() => setIsProfileOpen(!isProfileOpen)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
                  >
                    {user.profile_picture ? (
                      <img 
                        src={user.profile_picture} 
                        alt={user.full_name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-blue-500"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {user.full_name?.charAt(0) || 'U'}
                      </div>
                    )}
                  </button>

                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border z-50">
                      <div className="p-4 border-b">
                        <p className="font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                      
                      <div className="p-2">
                        <button
                          onClick={() => {
                            router.push('/dashboard/profile');
                            setIsProfileOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                        >
                          <FiUser size={18} />
                          My Profile
                        </button>
                        
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2 text-red-600"
                        >
                          <FiLogOut size={18} />
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

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
          <div className="container mx-auto max-w-4xl">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-white rounded-lg p-8 shadow-sm">
                  <FiSend size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-700 mb-2">No messages yet</h3>
                  <p className="text-gray-500">Start the conversation by sending a message below</p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const isMyMessage = message.sender_id === user.id;
                const showDateHeader = index === 0 || 
                  formatDate(messages[index - 1].created_at) !== formatDate(message.created_at);
                
                return (
                  <div key={message.id}>
                    {/* Date Header */}
                    {showDateHeader && (
                      <div className="flex justify-center my-4">
                        <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                          {formatDate(message.created_at)}
                        </span>
                      </div>
                    )}

                    {/* Message */}
                    <div className={`flex gap-3 ${isMyMessage ? 'flex-row-reverse' : ''}`}>
                      {/* Avatar */}
                      {!isMyMessage && (
                        <div className="flex-shrink-0">
                          {message.sender_picture ? (
                            <img
                              src={message.sender_picture}
                              alt={message.sender_name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-white text-xs font-bold">
                              {message.sender_name?.charAt(0)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Message Content */}
                      <div className={`flex flex-col max-w-md ${isMyMessage ? 'items-end' : 'items-start'}`}>
                        {!isMyMessage && (
                          <span className="text-xs text-gray-500 mb-1">{message.sender_name}</span>
                        )}
                        
                        <div className={`rounded-lg px-4 py-2 ${
                          isMyMessage 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-white text-gray-900 shadow-sm border'
                        }`}>
                          {message.flagged_for_contact_info && (
                            <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${
                              isMyMessage ? 'border-blue-400' : 'border-gray-200'
                            }`}>
                              <FiAlertTriangle size={14} className={isMyMessage ? 'text-yellow-200' : 'text-yellow-600'} />
                              <span className={`text-xs ${isMyMessage ? 'text-yellow-200' : 'text-yellow-600'}`}>
                                May contain contact info
                              </span>
                            </div>
                          )}
                          
                          <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
                          
                          {message.attachments && message.attachments !== '[]' && (
                            <div className="mt-2">
                              {renderAttachment(message.attachments)}
                            </div>
                          )}
                        </div>
                        
                        <span className="text-xs text-gray-400 mt-1">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Message Input */}
        <div className="bg-white border-t p-4 flex-shrink-0">
          <div className="container mx-auto max-w-4xl">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              {/* File Upload Button */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition flex-shrink-0"
                title="Attach file"
              >
                <FiPaperclip size={20} />
              </button>

              {/* Message Input */}
              <div className="flex-1">
                {selectedFile && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FiImage size={16} className="text-blue-600" />
                      <span className="text-sm text-blue-900 truncate">{selectedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <FiX size={18} />
                    </button>
                  </div>
                )}
                
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Type your message..."
                  rows={1}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={(!newMessage.trim() && !selectedFile) || sending}
                className={`p-3 rounded-lg transition flex-shrink-0 ${
                  (!newMessage.trim() && !selectedFile) || sending
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {sending ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <FiSend size={20} />
                )}
              </button>
            </form>
            
            <p className="text-xs text-gray-400 mt-2 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>

      {/* Booking Details Sidebar */}
      {showBookingDetails && bookingInfo && otherParticipant && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-end"
          onClick={() => setShowBookingDetails(false)}
        >
          <div 
            className="bg-white h-full w-96 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Close Button */}
              <button
                onClick={() => setShowBookingDetails(false)}
                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiX size={20} />
              </button>

              {/* Participant Info */}
              <div className="text-center mb-6">
                {otherParticipant.picture ? (
                  <img
                    src={otherParticipant.picture}
                    alt={otherParticipant.name}
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 bg-gray-300 rounded-full flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
                    {otherParticipant.name.charAt(0)}
                  </div>
                )}
                <h2 className="text-2xl font-bold text-gray-900">{otherParticipant.name}</h2>
                <p className="text-gray-500">{otherParticipant.role}</p>
                
                <div className="flex gap-2 justify-center mt-4">
                  
                    href={`tel:${otherParticipant.phone}`}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                  >
                    <FiPhone size={16} />
                    Call
                  </a>
                  
                    href={`mailto:${otherParticipant.email}`}
                    className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    <FiMail size={16} />
                    Email
                  </a>
                </div>
              </div>

              {/* Booking Details */}
              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold text-gray-900 mb-4">Booking Details</h3>
                
                <div className="flex items-start gap-3">
                  <FiBriefcase className="text-blue-600 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Job Title</p>
                    <p className="font-medium text-gray-900">{bookingInfo.job_title}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FiDollarSign className="text-green-600 mt-1 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-sm text-gray-500">Agreed Amount</p>
                    <p className="font-medium text-gray-900">Rs {bookingInfo.agreed_amount}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    bookingInfo.status === 'completed' ? 'bg-green-100' :
                    bookingInfo.status === 'in_progress' ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      bookingInfo.status === 'completed' ? 'bg-green-600' :
                      bookingInfo.status === 'in_progress' ? 'bg-yellow-600' :
                      'bg-blue-600'
                    }`}></div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium text-gray-900 capitalize">{bookingInfo.status.replace('_', ' ')}</p>
                  </div>
                </div>

                {bookingInfo.scheduled_date && (
                  <div className="flex items-start gap-3">
                    <FiMapPin className="text-purple-600 mt-1 flex-shrink-0" size={20} />
                    <div>
                      <p className="text-sm text-gray-500">Scheduled Date</p>
                      <p className="font-medium text-gray-900">
                        {new Date(bookingInfo.scheduled_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}