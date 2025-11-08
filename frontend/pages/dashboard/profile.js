// frontend/pages/dashboard/profile.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../../store/authStore';
import apiClient from '../../utils/apiClient';

export default function PersonalProfilePage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      // Use current user data
      setProfile(user);

      // Try to fetch updated data from API
      try {
        const userResponse = await apiClient.get(`/profiles/user/${user.id}`);
        if (userResponse.data.success) {
          setProfile(userResponse.data.data.user);
        }
      } catch (err) {
        console.log('Using cached user data');
      }

    } catch (err) {
      setError('Failed to load profile');
      console.error('Fetch profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProfile = () => {
    router.push('/dashboard/edit-profile');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        
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
          <div className="h-32 bg-gradient-to-r from-blue-500 to-purple-600"></div>
          
          {/* Profile Info */}
          <div className="px-6 pb-6">
            <div className="flex items-start gap-6 -mt-16">
              {/* Profile Picture */}
              <div className="relative">
                <img
                  src={profile?.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&size=128&background=6366f1&color=fff`}
                  alt={profile?.full_name || 'User'}
                  className="w-32 h-32 rounded-full border-4 border-white object-cover shadow-lg bg-gray-100"
                />
              </div>

              {/* Profile Details */}
              <div className="flex-1 mt-16">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                      {profile?.full_name || 'User Name'}
                      <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-normal">
                        Personal Profile
                      </span>
                    </h1>
                    <p className="text-gray-600 mt-1">
                      {profile?.role === 'worker' || profile?.role === 'both' ? 'Customer & Service Provider' : 'Customer'}
                    </p>
                  </div>

                  {/* Edit Button */}
                  <button
                    onClick={handleEditProfile}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit Personal Profile
                  </button>
                </div>

                {/* Contact Info */}
                <div className="flex flex-wrap gap-6 mt-4">
                  {profile?.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="text-sm">{profile.email}</span>
                    </div>
                  )}
                  {profile?.phone && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-sm">{profile.phone}</span>
                    </div>
                  )}
                  {profile?.city && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-sm">{profile.city}{profile.province ? `, ${profile.province}` : ''}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Information Card */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Personal Information</h2>
          
          <div className="space-y-6">
            
            {/* Bio */}
            {profile?.bio && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Bio</h3>
                <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            {/* Contact Details Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              
              {profile?.city && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Location</h3>
                  <p className="text-gray-700">
                    {profile.city}{profile.province ? `, ${profile.province}` : ''}
                  </p>
                </div>
              )}

              {profile?.address && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Address</h3>
                  <p className="text-gray-700">{profile.address}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Email</h3>
                <p className="text-gray-700">{profile?.email}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Phone</h3>
                <p className="text-gray-700">{profile?.phone}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-1">Account Type</h3>
                <p className="text-gray-700 capitalize">{profile?.role}</p>
              </div>

            </div>

            {/* Empty State */}
            {!profile?.bio && !profile?.city && !profile?.address && (
              <div className="text-center py-8 text-gray-500">
                <p>Complete your personal profile to get started</p>
                <button
                  onClick={handleEditProfile}
                  className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Complete Personal Profile
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Worker Profile Link (if applicable) */}
        {(user?.role === 'worker' || user?.role === 'both') && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-1">
                  Worker Profile
                </h3>
                <p className="text-sm text-gray-600">
                  Manage your professional profile, services, and rates
                </p>
              </div>
              <button
                onClick={() => router.push('/dashboard/worker-profile')}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
              >
                View Worker Profile →
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}