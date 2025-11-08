// frontend/pages/dashboard/edit-profile.js
// FIXED - Proper response handling
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../../store/authStore';
import apiClient from '../../utils/apiClient';
import toast from 'react-hot-toast';
import CitySelector from '../../components/CitySelector';
export default function EditProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // User Profile Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [bio, setBio] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState('');


  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    try {
      if (user) {
        setFullName(user.full_name || '');
        setPhone(user.phone || '');
        setAddress(user.address || '');
        setCity(user.city || '');
        setProvince(user.province || '');
        setBio(user.bio || '');
        setProfilePicturePreview(user.profile_picture || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      setProfilePicture(file);
      setProfilePicturePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!fullName || fullName.trim().length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }

    if (!phone || phone.length < 10) {
      toast.error('Please provide a valid phone number');
      return;
    }

    if (!city) {
      toast.error('City is required');
      return;
    }

    if (!province) {
      toast.error('Province is required');
      return;
    }

    setLoading(true);

    try {
      // Update user profile
      const userFormData = new FormData();
      userFormData.append('full_name', fullName);
      userFormData.append('phone', phone);
      userFormData.append('address', address || '');
      userFormData.append('city', city);
      userFormData.append('province', province);
      userFormData.append('bio', bio || '');
      
      if (profilePicture) {
        userFormData.append('image', profilePicture);
      }

      console.log('Submitting profile update...');
      const response = await apiClient.put('/profiles/me', userFormData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      console.log('Full response:', response);
      console.log('Response data:', response.data);

      // Handle response - check if data exists and has success property
      const responseData = response.data || response;
      
      if (responseData.success) {
        // Update Zustand store with new user data
        const updatedUser = responseData.user;
        console.log('Updating user in store:', updatedUser);
        setUser(updatedUser);
        
        toast.success('Profile updated successfully!');
        
        // Redirect after short delay
        setTimeout(() => {
          router.push('/dashboard/profile');
        }, 1500);
      } else {
        toast.error(responseData.message || 'Failed to update profile');
      }

    } catch (error) {
      console.error('Profile update error:', error);
      console.error('Error response:', error.response);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update profile';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-3xl font-bold text-gray-800">Edit Personal Profile</h1>
          <p className="text-gray-600 mt-2">Update your basic information</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Profile Picture */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Profile Picture</h2>
            <div className="flex items-center gap-6">
              <div className="relative">
                <img
                  src={profilePicturePreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'User')}&size=128&background=6366f1&color=fff`}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Change Picture
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Personal Information</h2>
            <div className="grid md:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>






     






              <div className="md:col-span-2">
                <CitySelector
                  selectedCity={city}
                  selectedProvince={province}
                  onCityChange={setCity}
                  onProvinceChange={setProvince}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complete Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House/Street/Area details"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
			  
			  
			  
			  
			  
			  
			  

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio / About
                </label>
                <textarea
                  rows="4"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : 'Save Changes'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}