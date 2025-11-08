// frontend/pages/admin/reports.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  FiAlertTriangle,
  FiUser,
  FiMessageSquare,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiEye,
  FiLoader,
  FiSearch,
  FiFilter,
  FiLogOut,
  FiHome,
  FiSend,
  FiPaperclip,
  FiX,
  FiImage
} from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import ImageLightbox from '../../components/ImageLightbox';

export default function AdminReports() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const fileInputRef = useRef(null);
  const [filters, setFilters] = useState({
    status: '',
    reported_type: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAuthChecked(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!authChecked) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (!token || !isAuthenticated) {
      toast.error('Please login to access admin portal');
      router.push('/login');
      return;
    }

    if (user?.role !== 'admin') {
      toast.error('Access denied. Admin privileges required.');
      router.push('/');
      return;
    }

    fetchReports();
  }, [authChecked, isAuthenticated, user, filters, pagination.page]);

  const fetchReports = async () => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(filters.status && { status: filters.status }),
        ...(filters.reported_type && { reported_type: filters.reported_type }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`http://localhost:5000/api/admin/reports?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.status === 401 || response.status === 403) {
        toast.error('Session expired. Please login again.');
        logout();
        router.push('/login');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setReports(data.data.reports);
        setPagination(prev => ({ ...prev, ...data.data.pagination }));
      } else {
        toast.error(data.message || 'Failed to fetch reports');
      }
    } catch (error) {
      console.error('Fetch reports error:', error);
      toast.error('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const openReportDetails = async (report) => {
    setSelectedReport(report);
    await fetchChatMessages(report.id);
  };

  const fetchChatMessages = async (reportId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/admin/reports/${reportId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setChatMessages(data.data.messages);
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + selectedImages.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setUploadingImages(true);
    const imagePromises = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({
          file,
          preview: e.target.result,
          name: file.name
        });
        reader.readAsDataURL(file);
      });
    });

    Promise.all(imagePromises).then(newImages => {
      setSelectedImages(prev => [...prev, ...newImages]);
      setUploadingImages(false);
    }).catch(error => {
      console.error('Image loading error:', error);
      toast.error('Failed to load images');
      setUploadingImages(false);
    });
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const openLightbox = (images, index = 0) => {
    let imageArray = images;
    if (typeof images === 'string') {
      try {
        imageArray = JSON.parse(images);
      } catch (e) {
        imageArray = [images];
      }
    }
    if (!Array.isArray(imageArray)) {
      imageArray = [imageArray];
    }
    
    setLightboxImages(imageArray);
    setLightboxIndex(index);
    setShowLightbox(true);
  };

  const renderMessageAttachments = (attachments) => {
    try {
      let images = attachments || [];
      if (typeof images === 'string') {
        images = JSON.parse(images);
      }
      if (!Array.isArray(images) || images.length === 0) return null;

      return (
        <div className="flex flex-wrap gap-2 mt-2">
		
		
		
		
     {images.map((img, idx) => (
                              <div
                                key={idx}
                                className="w-20 h-20 rounded cursor-pointer hover:opacity-80 border-2 border-transparent hover:border-blue-500 transition overflow-hidden"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openLightbox(images, idx);
                                }}
                                title="Click to view full size"
                                style={{ 
                                  backgroundImage: `url(${img})`,
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center'
                                }}
                              />
                            ))}
		  
		  
		  
		  
		  
        </div>
      );
    } catch (error) {
      console.error('Error rendering attachments:', error);
      return null;
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedImages.length === 0) || !selectedReport) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/admin/reports/${selectedReport.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          message: newMessage.trim() || '📎 Image attachment',
          attachments: selectedImages.map(img => img.preview)
        })
      });

      const data = await response.json();
      if (data.success) {
        setChatMessages(prev => [...prev, data.data.message]);
        setNewMessage('');
        setSelectedImages([]);
        toast.success('Message sent');
        
        setReports(prev => prev.map(r => 
          r.id === selectedReport.id 
            ? { ...r, status: r.status === 'pending' ? 'processing' : r.status }
            : r
        ));
      } else {
        toast.error(data.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast.error('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const updateReportStatus = async (reportId, status, admin_notes = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/admin/reports/${reportId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status, admin_notes })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Report status updated');
        fetchReports();
        if (selectedReport?.id === reportId) {
          setSelectedReport(data.data.report);
        }
      } else {
        toast.error(data.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      reviewing: 'bg-blue-100 text-blue-800',
      processing: 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      dismissed: 'bg-gray-100 text-gray-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: <FiClock className="w-3 h-3" />,
      reviewing: <FiEye className="w-3 h-3" />,
      processing: <FiEye className="w-3 h-3" />,
      resolved: <FiCheckCircle className="w-3 h-3" />,
      dismissed: <FiXCircle className="w-3 h-3" />
    };
    return icons[status] || <FiClock className="w-3 h-3" />;
  };

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <FiLoader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Reports Management - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/admin/dashboard">
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <FiHome className="w-5 h-5" />
                  </button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Reports Management</h1>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <FiLogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Reports List */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow">
              {/* Filters */}
              <div className="p-4 border-b space-y-3">
                <input
                  type="text"
                  placeholder="Search by case ID, title, or reporter..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                  <select
                    value={filters.reported_type}
                    onChange={(e) => setFilters({ ...filters, reported_type: e.target.value })}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Types</option>
                    <option value="worker">Worker</option>
                    <option value="job">Job</option>
                    <option value="user">User</option>
                    <option value="message">Message</option>
                    <option value="review">Review</option>
                  </select>
                </div>
              </div>

              {/* Reports List */}
              <div className="divide-y max-h-[600px] overflow-y-auto">
                {reports.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <FiAlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                    <p>No reports found</p>
                  </div>
                ) : (
                  reports.map((report) => (
                    <div
                      key={report.id}
                      onClick={() => openReportDetails(report)}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                        selectedReport?.id === report.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="font-mono text-sm font-semibold text-gray-700">
                              {report.case_id}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs flex items-center space-x-1 ${getStatusBadge(report.status)}`}>
                              {getStatusIcon(report.status)}
                              <span className="capitalize">{report.status}</span>
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs capitalize">
                              {report.reported_type}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
                          <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                        <div className="flex items-center space-x-4">
                          <span className="flex items-center space-x-1">
                            <FiUser className="w-3 h-3" />
                            <span>{report.reporter_name}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <FiMessageSquare className="w-3 h-3" />
                            <span>{report.total_messages || 0} messages</span>
                          </span>
                        </div>
                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                      </div>

                      {report.unread_customer_messages > 0 && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                            {report.unread_customer_messages} new message{report.unread_customer_messages > 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="p-4 border-t flex items-center justify-between">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>

            {/* Report Details & Chat */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow">
              {!selectedReport ? (
                <div className="p-8 text-center text-gray-500">
                  <FiMessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                  <p>Select a report to view details and chat</p>
                </div>
              ) : (
                <>
                  {/* Report Details */}
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-bold text-lg">{selectedReport.case_id}</h2>
                      <button
                        onClick={() => setSelectedReport(null)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <FiXCircle className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <h3 className="font-semibold text-gray-900 mb-2">{selectedReport.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{selectedReport.description}</p>
                    
                    {(() => {
                      try {
                        let images = selectedReport.images || [];
                        if (typeof images === 'string') {
                          images = JSON.parse(images);
                        }
                        return Array.isArray(images) && images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
						  
						  
						  
						  
                        {images.map((img, idx) => (
  <div
    key={idx}
    className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80 border-2 border-transparent hover:border-blue-500 transition overflow-hidden"
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      openLightbox(images, idx);
    }}
    title="Click to view full size"
    style={{ 
      backgroundImage: `url(${img})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    }}
  />
))}
							
							
							
							
							
                          </div>
                        );
                      } catch (error) {
                        console.error('Error parsing images:', error);
                        return null;
                      }
                    })()}

                    <div className="text-xs text-gray-500 space-y-1 mb-3">
                      <p><strong>Reporter:</strong> {selectedReport.reporter_name} ({selectedReport.reporter_email})</p>
                      <p><strong>Reported:</strong> {selectedReport.reported_user_name || 'N/A'}</p>
                      <p><strong>Type:</strong> {selectedReport.reported_type}</p>
                      <p><strong>Reason:</strong> {selectedReport.reason}</p>
                    </div>

                    {/* Status Update */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Update Status</label>
                      <select
                        value={selectedReport.status}
                        onChange={(e) => updateReportStatus(selectedReport.id, e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="resolved">Resolved</option>
                        <option value="dismissed">Dismissed</option>
                      </select>
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="h-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs px-4 py-2 rounded-lg ${
                            msg.sender_type === 'admin'
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-900 border'
                          }`}
                        >
                          <p className="text-sm">{msg.message}</p>
                          {renderMessageAttachments(msg.attachments)}
                          <span className="text-xs opacity-75 mt-1 block">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Send Message */}
                  <form onSubmit={sendMessage} className="p-4 border-t">
                    {/* Image Preview */}
                    {selectedImages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-50 rounded">
                        {selectedImages.map((img, idx) => (
                          <div key={idx} className="relative">
                            <img src={img.preview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                            <button
                              type="button"
                              onClick={() => removeImage(idx)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                            >
                              <FiX className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-1"
                        disabled={sendingMessage || uploadingImages || selectedImages.length >= 5}
                        title="Attach images (max 5)"
                      >
                        <FiPaperclip className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your reply..."
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        disabled={sendingMessage}
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || (!newMessage.trim() && selectedImages.length === 0)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                      >
                        {sendingMessage ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSend className="w-4 h-4" />}
                        <span>Send</span>
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {showLightbox && (
        <ImageLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setShowLightbox(false)}
        />
      )}
    </>
  );
}