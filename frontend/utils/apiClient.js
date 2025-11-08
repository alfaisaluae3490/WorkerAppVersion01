// frontend/utils/apiClient.js
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    // Return the actual data from the response
    return response.data;
  },
  (error) => {
    if (error.response) {
      const message = error.response.data?.message || 'An error occurred';
      
      // Handle specific error codes
      if (error.response.status === 401) {
        // Only clear auth and redirect if NOT on login/signup page
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const isAuthPage = ['/login', '/signup', '/verify-otp'].includes(currentPath);
          
          if (!isAuthPage) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            toast.error('Session expired. Please login again.');
            window.location.href = '/login';
          } else {
            // On auth pages, just show the error without redirecting
            toast.error(message);
          }
        }
      } else if (error.response.status === 403) {
        toast.error(message || 'Access denied');
      } else if (error.response.status === 404) {
        toast.error('Resource not found');
      } else if (error.response.status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(message);
      }
    } else if (error.request) {
      toast.error('Network error. Please check your connection.');
    } else {
      toast.error('An unexpected error occurred');
    }
    
    return Promise.reject(error);
  }
);

// ============================================
// AUTH API
// ============================================
export const authAPI = {
  signup: (data) => apiClient.post('/auth/signup', data),
  verifyOTP: (data) => apiClient.post('/auth/verify-otp', data),
  resendOTP: (data) => apiClient.post('/auth/resend-otp', data),
  login: (data) => apiClient.post('/auth/login', data),
  getProfile: () => apiClient.get('/auth/me'),
  switchRole: (data) => apiClient.post('/auth/switch-role', data),
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.resolve();
  },
};

// ============================================
// JOBS API
// ============================================
export const jobsAPI = {
  // Get all jobs with filters
  getJobs: (params) => apiClient.get('/jobs', { params }),
  
  // Get single job by ID (with optional params like worker_city)
  getJob: (id, params) => apiClient.get(`/jobs/${id}`, { params }),
  
  // Create new job
  createJob: (data) => apiClient.post('/jobs', data),
  
  // Update job
  updateJob: (id, data) => apiClient.put(`/jobs/${id}`, data),
  
  // Delete job
  deleteJob: (id) => apiClient.delete(`/jobs/${id}`),
  
  // Get my jobs (posted by me)
  getMyJobs: () => apiClient.get('/jobs/my-jobs'),
  
  // Update job status
  updateJobStatus: (id, status) => apiClient.patch(`/jobs/${id}/status`, { status }),
};

// ============================================
// BIDS API
// ============================================
export const bidsAPI = {
  // Get all bids for a job
  getJobBids: (jobId) => apiClient.get(`/bids/job/${jobId}`),
  
  // Create a bid
  createBid: (data) => apiClient.post('/bids', data),
  
  // Get my bids (placed by me as a worker)
  getMyBids: () => apiClient.get('/bids/my-bids'),
  
  // Accept a bid
  acceptBid: (bidId) => apiClient.post(`/bids/${bidId}/accept`),
  
  // Reject a bid
  rejectBid: (bidId) => apiClient.post(`/bids/${bidId}/reject`),
  
  // Withdraw a bid (worker cancels their own bid)
  withdrawBid: (bidId) => apiClient.delete(`/bids/${bidId}`),
  
  // Update a bid
  updateBid: (bidId, data) => apiClient.put(`/bids/${bidId}`, data),
};

// ============================================
// CATEGORIES API
// ============================================
export const categoriesAPI = {
  // Get all categories
  getCategories: () => apiClient.get('/categories'),
  
  // Get category by ID
  getCategory: (id) => apiClient.get(`/categories/${id}`),
};

// ============================================
// PROFILES API
// ============================================
export const profilesAPI = {
  // Get worker profile
  getWorkerProfile: (userId) => apiClient.get(`/profiles/worker/${userId}`),
  
  // Create/Update worker profile
  updateWorkerProfile: (data) => apiClient.put('/profiles/worker', data),
  
  // Get my worker profile
  getMyWorkerProfile: () => apiClient.get('/profiles/worker/me'),
  
  // Update user profile (customer info)
  updateUserProfile: (data) => {
    const config = data instanceof FormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
    return apiClient.put("/profiles/user", data, config);
  },
};

// ============================================
// NOTIFICATIONS API
// ============================================
export const notificationsAPI = {
  getNotifications: (params = {}) => apiClient.get("/notifications", { params }),
  getUnreadCount: () => apiClient.get("/notifications/unread-count"),
  markAsRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAsUnread: (id) => apiClient.put(`/notifications/${id}/unread`),
  markAllAsRead: () => apiClient.put("/notifications/mark-all-read"),
  deleteNotification: (id) => apiClient.delete(`/notifications/${id}`),
  deleteAllRead: () => apiClient.delete("/notifications"),
};

// ============================================
// MESSAGES API
// ============================================
export const messagesAPI = {
  // Get all conversations for current user
  getConversations: () => apiClient.get('/messages/conversations'),
  
  // Get messages for a specific booking
  getMessages: (bookingId) => apiClient.get(`/messages/${bookingId}`),
  
  // Send a message
  sendMessage: (data) => {
    // If data contains a file, use FormData
    if (data.attachment) {
      const formData = new FormData();
      formData.append('booking_id', data.booking_id);
      formData.append('message', data.message);
      formData.append('attachment', data.attachment);
      
      return apiClient.post('/messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
    }
    return apiClient.post('/messages', data);
  },
  
  // Mark message as read
  markAsRead: (messageId) => apiClient.put(`/messages/${messageId}/read`),
  
  // Get booking info for chat
  getBookingInfo: (bookingId) => apiClient.get(`/messages/booking/${bookingId}/info`),
};

// ============================================
// BOOKINGS API
// ============================================
export const bookingsAPI = {
  // Get my bookings
  getMyBookings: () => apiClient.get('/bookings/my-bookings'),
  
  // Get single booking
  getBooking: (id) => apiClient.get(`/bookings/${id}`),
  
  // Update booking status
  updateStatus: (id, status) => apiClient.patch(`/bookings/${id}/status`, { status }),
  
  // Complete booking
  completeBooking: (id, data) => apiClient.post(`/bookings/${id}/complete`, data),
};

// ============================================
// REVIEWS API
// ============================================
export const reviewsAPI = {
  // Get reviews for a user
  getUserReviews: (userId) => apiClient.get(`/reviews/user/${userId}`),
  
  // Create review
  createReview: (data) => apiClient.post('/reviews', data),
  
  // Get my pending reviews
  getPendingReviews: () => apiClient.get('/reviews/pending'),
};

// ============================================
// ADMIN API
// ============================================
export const adminAPI = {
  // Dashboard
  getDashboard: () => apiClient.get('/admin/dashboard/analytics'),
  
  // Users
  getUsers: (params) => apiClient.get('/admin/users', { params }),
  getUser: (id) => apiClient.get(`/admin/users/${id}`),
  createUser: (data) => apiClient.post('/admin/users/create', data),
  updateUser: (id, data) => {
    const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
    return apiClient.patch(`/admin/users/${id}`, data, config);
  },
  deleteUser: (id) => apiClient.delete(`/admin/users/${id}`),
  toggleUserStatus: (id, data) => apiClient.patch(`/admin/users/${id}/toggle-active`, data),
  verifyWorker: (id) => apiClient.patch(`/admin/users/${id}/verify-worker`),
  resetPassword: (id, data) => apiClient.patch(`/admin/users/${id}/reset-password`, data),
  updateWorkerProfile: (id, data) => apiClient.patch(`/admin/users/${id}/worker-profile`, data),
  updateCustomerProfile: (id, data) => apiClient.patch(`/admin/users/${id}/customer-profile`, data),
  
  // Jobs
  getJobs: (params) => apiClient.get('/admin/jobs', { params }),
  getJob: (id) => apiClient.get(`/admin/jobs/${id}`),
  updateJobStatus: (id, data) => apiClient.patch(`/admin/jobs/${id}/status`, data),
  deleteJob: (id) => apiClient.delete(`/admin/jobs/${id}`),
  
  // Bookings
  getBookings: (params) => apiClient.get('/admin/bookings', { params }),
  
  // Reports
  getReports: (params) => apiClient.get('/admin/reports', { params }),
  updateReport: (id, data) => apiClient.patch(`/admin/reports/${id}`, data),
  
  // Disputes
  getDisputes: (params) => apiClient.get('/admin/disputes', { params }),
  updateDispute: (id, data) => apiClient.patch(`/admin/disputes/${id}`, data),
  
  // Categories
  getCategories: () => apiClient.get('/admin/categories'),
  createCategory: (data) => apiClient.post('/admin/categories', data),
  updateCategory: (id, data) => apiClient.patch(`/admin/categories/${id}`, data),
  deleteCategory: (id) => apiClient.delete(`/admin/categories/${id}`),
  
  // Locations
  getProvinces: () => apiClient.get('/admin/locations/provinces'),
  createProvince: (data) => apiClient.post('/admin/locations/provinces', data),
  updateProvince: (id, data) => apiClient.patch(`/admin/locations/provinces/${id}`, data),
  deleteProvince: (id) => apiClient.delete(`/admin/locations/provinces/${id}`),
  
  getCities: (params) => apiClient.get('/admin/locations/cities', { params }),
  createCity: (data) => apiClient.post('/admin/locations/cities', data),
  updateCity: (id, data) => apiClient.patch(`/admin/locations/cities/${id}`, data),
  deleteCity: (id) => apiClient.delete(`/admin/locations/cities/${id}`),
  
  // Logs
  getLogs: (params) => apiClient.get('/admin/logs', { params }),
};

// ============================================
// LOCATIONS API
// ============================================
export const locationsAPI = {
  getProvinces: () => apiClient.get('/locations/provinces'),
  getCities: (provinceId) => apiClient.get('/locations/cities', { params: { province_id: provinceId } }),
};

// ============================================
// UPLOAD HELPER
// ============================================
export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'ml_default');

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your-cloud-name'}/image/upload`,
      formData
    );
    return response.data.secure_url;
  } catch (error) {
    console.error('Upload error:', error);
    throw new Error('Failed to upload image');
  }
};

export default apiClient;