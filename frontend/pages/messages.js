// frontend/pages/messages.js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiMessageSquare, 
  FiUser, 
  FiLogOut, 
  FiSearch,
  FiClock,
  FiArrowLeft,
  FiInbox
} from 'react-icons/fi';
import useAuthStore from '../store/authStore';
import { messagesAPI } from '../utils/apiClient';
import toast from 'react-hot-toast';
import NotificationBell from '../components/NotificationBell';

export default function MessagesPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    } else {
      fetchConversations();
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

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await messagesAPI.getConversations();
      
      if (response.success) {
        setConversations(response.data.conversations || []);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const getOtherParticipant = (conversation) => {
    if (user.id === conversation.customer_id) {
      return {
        id: conversation.worker_id,
        name: conversation.worker_name,
        picture: conversation.worker_picture,
        role: 'Worker'
      };
    } else {
      return {
        id: conversation.customer_id,
        name: conversation.customer_name,
        picture: conversation.customer_picture,
        role: 'Customer'
      };
    }
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const filteredConversations = conversations.filter(conv => {
    const other = getOtherParticipant(conv);
    return (
      other.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.job_title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

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
        <title>Messages - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-50">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              {/* Logo */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => router.back()}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <FiArrowLeft size={20} />
                </button>
                <Link href="/">
                  <h1 className="text-2xl font-bold text-blue-600 cursor-pointer">
                    Services Marketplace
                  </h1>
                </Link>
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

                  {/* Dropdown Menu */}
                  {isProfileOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border z-50">
                      <div className="p-4 border-b">
                        <p className="font-semibold text-gray-900">{user.full_name}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                        <span className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded mt-2">
                          {user.role}
                        </span>
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
                          onClick={() => {
                            const dashboardPath = user.role === 'worker' ? '/dashboard/worker' : '/dashboard/customer';
                            router.push(dashboardPath);
                            setIsProfileOpen(false);
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
                        >
                          <FiMessageSquare size={18} />
                          Dashboard
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

        {/* Main Content */}
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FiMessageSquare className="text-blue-600" />
              Messages
            </h1>
            <p className="text-gray-600 mt-1">Chat with your customers and workers</p>
          </div>

          {/* Search Bar */}
          <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="bg-white rounded-lg shadow-sm">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-500 mt-4">Loading conversations...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-12 text-center">
                <FiInbox size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  {searchQuery ? 'No conversations found' : 'No messages yet'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery 
                    ? 'Try searching with different keywords' 
                    : 'Start chatting after accepting or placing bids'}
                </p>
                <button
                  onClick={() => {
                    const dashboardPath = user.role === 'worker' ? '/dashboard/worker' : '/dashboard/customer';
                    router.push(dashboardPath);
                  }}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="divide-y">
                {filteredConversations.map((conversation) => {
                  const other = getOtherParticipant(conversation);
                  const unreadCount = parseInt(conversation.unread_count) || 0;
                  
                  return (
                    <div
                      key={conversation.booking_id}
                      onClick={() => router.push(`/chat/${conversation.booking_id}`)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                        unreadCount > 0 ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        {other.picture ? (
                          <img
                            src={other.picture}
                            alt={other.name}
                            className="w-14 h-14 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-gray-300 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {other.name.charAt(0)}
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className={`font-semibold ${unreadCount > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                                {other.name}
                              </h3>
                              <p className="text-xs text-gray-500">{other.role}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {formatTimeAgo(conversation.last_message_time)}
                              </span>
                              {unreadCount > 0 && (
                                <span className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                                  {unreadCount}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <p className="text-sm text-blue-600 font-medium mt-1">
                            {conversation.job_title}
                          </p>
                          
                          {conversation.last_message && (
                            <p className={`text-sm mt-1 truncate ${
                              unreadCount > 0 ? 'text-gray-900 font-medium' : 'text-gray-600'
                            }`}>
                              {conversation.last_message}
                            </p>
                          )}
                          
                          <span className={`inline-block text-xs px-2 py-1 rounded-full mt-2 ${
                            conversation.booking_status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                            conversation.booking_status === 'completed' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {conversation.booking_status}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}