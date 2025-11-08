// frontend/pages/worker/[id].js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import apiClient from '../../utils/apiClient';
import ReviewsSection from '../../components/ReviewsSection';
import { FiArrowLeft, FiMapPin, FiStar, FiBriefcase, FiAward } from 'react-icons/fi';

export default function PublicWorkerProfile() {
  const router = useRouter();
  const { id } = router.query;

  const [profile, setProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');

  useEffect(() => {
    if (id) {
      fetchWorkerProfile();
    }
  }, [id]);

  const fetchWorkerProfile = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/profiles/worker/profile/${id}`);
      
      if (response.success) {
        setProfile(response.data.profile || response.profile);
        setUser(response.data.user || response.user);
      }
    } catch (error) {
      console.error('Failed to load worker profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 text-lg mb-4">Worker profile not found</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 font-medium"
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
        <title>{user.full_name} - Worker Profile | Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 space-y-6">
          
          {/* Back Button */}
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <FiArrowLeft className="w-5 h-5" />
            Back
          </button>

          {/* Profile Header Card */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="h-32 bg-gradient-to-r from-green-500 to-blue-600"></div>
            
            <div className="px-6 pb-6">
              <div className="flex items-start gap-6 -mt-16">
                <div className="relative">
                  <img
                    src={user.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&size=128&background=10b981&color=fff`}
                    alt={user.full_name}
                    className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg bg-gray-100"
                  />
                  {profile.is_verified && (
                    <div className="absolute bottom-2 right-2 bg-green-600 rounded-full p-2 border-2 border-white">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>

                <div className="flex-1 pt-16">
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        {user.full_name}
                        {profile.is_verified && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                            Verified Worker
                          </span>
                        )}
                      </h1>
                      <p className="text-gray-600 mt-1">Service Provider</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex gap-8 mt-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-800">
                          {profile.average_rating || '0.00'}
                        </span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg 
                              key={star}
                              className={`w-5 h-5 ${star <= Math.round(parseFloat(profile.average_rating || 0)) ? 'text-yellow-400' : 'text-gray-300'}`}
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">{profile.total_reviews || 0} reviews</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-800">
                        {profile.total_jobs_completed || 0}
                      </div>
                      <p className="text-sm text-gray-600">Jobs Completed</p>
                    </div>
                    {profile.experience_years && (
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {profile.experience_years} years
                        </div>
                        <p className="text-sm text-gray-600">Experience</p>
                      </div>
                    )}
                  </div>

              {/* Contact Info */}
                  <div className="flex gap-6 mt-4">
                    {profile.city && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <FiMapPin className="w-4 h-4" />
                        <span className="text-sm">{profile.city}{profile.province ? `, ${profile.province}` : ''}</span>
                      </div>
                    )}
                  </div>
				  
				  
				  
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
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
                  Reviews ({profile.total_reviews || 0})
                </button>
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'about' && (
                <div className="space-y-6">
				
				
		

                  {profile.services && profile.services.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-2">Services Offered</h3>
                      <div className="flex flex-wrap gap-2">
                        {profile.services.map((service, index) => (
                          <span
                            key={index}
                            className="px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium"
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    {profile.experience_years && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Experience</h3>
                        <p className="text-gray-700">{profile.experience_years} years</p>
                      </div>
                    )}

                    {profile.city && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Service Location</h3>
                        <p className="text-gray-700">
                          {profile.city}{profile.province ? `, ${profile.province}` : ''}
                        </p>
                      </div>
                    )}

                    {profile.languages && profile.languages.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Languages</h3>
                        <p className="text-gray-700">{profile.languages.join(', ')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

         {activeTab === 'reviews' && (
                <>
                  {console.log('🔍 ReviewsSection userId:', user?.id)}
                  <ReviewsSection 
                    userId={user?.id} 
                    userType="worker"
                  />
                </>
              )}
			  
			  
            </div>
          </div>

        </div>
      </div>
    </>
  );
}