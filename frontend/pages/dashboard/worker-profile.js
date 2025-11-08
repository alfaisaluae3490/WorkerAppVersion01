// frontend/pages/dashboard/worker-profile.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../../store/authStore';
import apiClient, { categoriesAPI } from '../../utils/apiClient';
import ReviewsSection from '../../components/ReviewsSection';
import toast from 'react-hot-toast';

export default function WorkerProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [workerProfile, setWorkerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('about');
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (user.role !== 'worker' && user.role !== 'both') {
      toast.error('You need to be a worker to access this page');
      router.push('/dashboard/profile');
      return;
    }

    fetchData();
  }, [user]);

  const fetchData = async () => {
    await Promise.all([
      fetchWorkerProfile(),
      fetchCategories()
    ]);
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories();
      if (response.success) {
        const cats = response.data?.categories || response.categories || [];
        console.log('Categories loaded:', cats);
        setCategories(cats);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  // Get service names from category IDs
  const getServiceNames = (serviceIds) => {
    if (!serviceIds || !Array.isArray(serviceIds) || categories.length === 0) {
      return serviceIds || []; // Return IDs if can't map
    }
    
    return serviceIds.map(id => {
      const category = categories.find(cat => cat.id === id);
      return category ? category.name : id; // Return name or ID if not found
    }).filter(Boolean);
  };

  const fetchWorkerProfile = async () => {
    try {
      setLoading(true);
      
      const response = await apiClient.get('/profiles/worker/me');
      console.log('=== WORKER PROFILE RESPONSE ===');
      console.log('Full response:', response);
      console.log('Success:', response.success);
      
      if (response.success) {
        const profile = response.profile || response.data?.profile || response.data;
        console.log('Profile data:', profile);
        console.log('Bio:', profile?.bio);
        console.log('Services:', profile?.services, 'Type:', typeof profile?.services, 'Length:', profile?.services?.length);
        console.log('Experience:', profile?.experience_years);
        console.log('City:', profile?.city);
        setWorkerProfile(profile);
      }

    } catch (err) {
      console.error('Fetch worker profile error:', err);
      if (err.response?.status === 404) {
        // No worker profile yet
        setError('Worker profile not found. Please complete your worker profile.');
      } else {
        setError('Failed to load worker profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    router.push('/dashboard/edit-worker-profile');
  };

  // Check if profile is complete
  const isProfileComplete = () => {
    if (!workerProfile) {
      console.log('Profile incomplete: No workerProfile');
      return false;
    }
    
    const hasBio = !!workerProfile.bio;
    const hasServices = !!(workerProfile.services?.length > 0);
    const hasExperience = !!(workerProfile.experience_years || workerProfile.experience);
    const hasCity = !!(workerProfile.city || workerProfile.province);
    
    console.log('=== PROFILE COMPLETENESS CHECK ===');
    console.log('Has Bio:', hasBio, '→', workerProfile.bio?.substring(0, 30));
    console.log('Has Services:', hasServices, '→', workerProfile.services);
    console.log('Has Experience:', hasExperience, '→', workerProfile.experience_years);
    console.log('Has City:', hasCity, '→', workerProfile.city);
    console.log('Is Complete:', hasBio && hasServices && hasExperience && hasCity);
    
    return !!(hasBio && hasServices && hasExperience && hasCity);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !workerProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/edit-worker-profile')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Worker Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 space-y-6">
        
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>

        {/* Profile Header Card */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Cover Image */}
          <div className="h-32 bg-gradient-to-r from-green-500 to-blue-600"></div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex items-start gap-6 -mt-16">
              {/* Profile Picture */}
              <div className="relative">
                <img
                  src={user?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'Worker')}&size=128&background=10b981&color=fff`}
                  alt={user?.full_name || 'Worker'}
                  className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg bg-gray-100"
                />
                {workerProfile?.is_verified && (
                  <div className="absolute bottom-2 right-2 bg-green-600 rounded-full p-2 border-2 border-white">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Name and Stats */}
              <div className="flex-1 pt-16">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                      {user?.full_name}
                      {workerProfile?.is_verified && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                          Worker Profile
                        </span>
                      )}
                    </h1>
                    <p className="text-gray-600 mt-1">Service Provider</p>
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={handleEditProfile}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Worker Profile
                  </button>
                </div>

                {/* Stats Row */}
                {workerProfile && (
                  <div className="flex gap-8 mt-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-800">
                          {workerProfile.average_rating || '0.00'}
                        </span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg 
                              key={star}
                              className={`w-5 h-5 ${star <= Math.round(parseFloat(workerProfile.average_rating || 0)) ? 'text-yellow-400' : 'text-gray-300'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{workerProfile.total_reviews || 0} reviews</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-800">
                        {workerProfile.total_jobs_completed || 0}
                      </div>
                      <p className="text-sm text-gray-600">Jobs Completed</p>
                    </div>
                    {workerProfile.experience_years && (
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {workerProfile.experience_years} years
                        </div>
                        <p className="text-sm text-gray-600">Experience</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Info */}
                <div className="flex gap-6 mt-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm">{user?.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-sm">{user?.phone}</span>
                  </div>
                  {workerProfile?.city && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm">{workerProfile.city}{workerProfile.province ? `, ${workerProfile.province}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="border-b">
            <div className="flex gap-8 px-6">
              <button
                onClick={() => setActiveTab('about')}
                className={`py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'about'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                About
              </button>
              <button
                onClick={() => setActiveTab('reviews')}
                className={`py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'reviews'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Reviews ({workerProfile?.total_reviews || 0})
              </button>
              <button
                onClick={() => setActiveTab('portfolio')}
                className={`py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'portfolio'
                    ? 'border-green-600 text-green-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                Portfolio
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                
                {/* Bio */}
                {workerProfile?.bio && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Professional Bio</h3>
                    <p className="text-gray-700 leading-relaxed">{workerProfile.bio}</p>
                  </div>
                )}

                {/* Services */}
                {workerProfile?.services && workerProfile.services.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Services Offered</h3>
                    <div className="flex flex-wrap gap-2">
                      {getServiceNames(workerProfile.services).map((serviceName, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                        >
                          {serviceName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Professional Details Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  
                  {workerProfile?.experience_years && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Experience</h3>
                      <p className="text-gray-700">{workerProfile.experience_years} years</p>
                    </div>
                  )}

                  {workerProfile?.city && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Service Location</h3>
                      <p className="text-gray-700">
                        {workerProfile.city}{workerProfile.province ? `, ${workerProfile.province}` : ''}
                      </p>
                    </div>
                  )}

                  {workerProfile?.languages && workerProfile.languages.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Languages</h3>
                      <p className="text-gray-700">{workerProfile.languages.join(', ')}</p>
                    </div>
                  )}

                  {workerProfile?.address && (
                    <div className="md:col-span-2">
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Address</h3>
                      <p className="text-gray-700">{workerProfile.address}</p>
                    </div>
                  )}

                </div>

                {/* Profile Completion Alert - FIXED LOGIC */}
                {!isProfileComplete() && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-start gap-3">
                      <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="font-semibold text-yellow-800 mb-1">Profile Incomplete</h4>
                        <p className="text-yellow-700 text-sm mb-3">
                          Complete your profile to attract more customers. Missing: {[
                            !workerProfile?.bio && 'Bio',
                            !workerProfile?.services?.length && 'Services',
                            !workerProfile?.experience_years && 'Experience',
                            !workerProfile?.city && 'Location'
                          ].filter(Boolean).join(', ')}
                        </p>
                        <button
                          onClick={handleEditProfile}
                          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm font-medium transition-colors"
                        >
                          Complete Profile Now
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div>
                <ReviewsSection 
                  userId={user?.id} 
                  userType="worker"
                />
              </div>
            )}

            {/* Portfolio Tab */}
            {activeTab === 'portfolio' && (
              <div>
                <div className="text-center py-12 text-gray-500">
                  <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="mt-4">Portfolio items coming soon</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}