// frontend/pages/dashboard/edit-worker-profile.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useAuthStore from '../../store/authStore';
import apiClient, { categoriesAPI } from '../../utils/apiClient';
import toast from 'react-hot-toast';
import CitySelector from '../../components/CitySelector';

export default function EditWorkerProfilePage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState([]);
  
  // Form state
  const [formData, setFormData] = useState({
    bio: '',
    experience_years: '',
    city: '',
    province: '',
    address: '',
    services: [],
    languages: []
  });
  
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  const languageOptions = ['English', 'Urdu', 'Punjabi', 'Sindhi', 'Pashto', 'Balochi', 'Saraiki'];

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
    try {
      setLoading(true);
      
      // Fetch categories FIRST
      const catResponse = await categoriesAPI.getCategories();
      let loadedCategories = [];
      if (catResponse.success) {
        loadedCategories = catResponse.data.categories || [];
        setCategories(loadedCategories);
      }

      // Fetch existing worker profile
      try {
        const profileResponse = await apiClient.get('/profiles/worker/me');
        console.log('=== EDIT FORM: Fetched Profile ===');
        console.log('Response:', profileResponse);
        
        // apiClient returns response.data, so check profileResponse.success directly
        if (profileResponse.success) {
          const profile = profileResponse.data?.profile || profileResponse.profile;
          console.log('Profile for editing:', profile);
          
          if (profile) {
            // Convert service names to IDs if they're names
            let servicesArray = Array.isArray(profile.services) ? profile.services : [];
            
            // Check if services are names or IDs
            if (servicesArray.length > 0 && loadedCategories.length > 0) {
              const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(servicesArray[0]);
              
              if (!isUUID) {
                // Convert names to IDs
                console.log('Converting service names to IDs:', servicesArray);
                servicesArray = servicesArray.map(serviceName => {
                  const category = loadedCategories.find(cat => cat.name === serviceName);
                  return category ? category.id : null;
                }).filter(Boolean);
                console.log('Converted services:', servicesArray);
              }
            }
            
            setFormData({
              bio: profile.bio || '',
              experience_years: profile.experience_years || profile.experience || '',
              city: profile.city || '',
              province: profile.province || '',
              address: profile.address || '',
              services: servicesArray,
              languages: Array.isArray(profile.languages) ? profile.languages : []
            });
            console.log('Form data set:', {
              bio: profile.bio,
              services: servicesArray,
              languages: profile.languages
            });
          }
        }
      } catch (profileError) {
        // Profile doesn't exist yet - that's okay, keep empty form
        console.log('No existing profile found, creating new one');
      }

      // Set image preview from user
      if (user?.profile_picture) {
        setImagePreview(user.profile_picture);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleServiceToggle = (categoryId) => {
    setFormData(prev => {
      const currentServices = prev.services || [];
      const newServices = currentServices.includes(categoryId)
        ? currentServices.filter(id => id !== categoryId)
        : [...currentServices, categoryId];
      
      // Remove duplicates
      return {
        ...prev,
        services: [...new Set(newServices)]
      };
    });
  };

  const handleLanguageToggle = (language) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(language)
        ? prev.languages.filter(lang => lang !== language)
        : [...prev.languages, language]
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }
      
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.bio || formData.bio.trim().length < 20) {
      toast.error('Bio must be at least 20 characters');
      return;
    }

    if (!formData.experience_years || formData.experience_years < 0) {
      toast.error('Please enter valid years of experience');
      return;
    }

    if (formData.services.length === 0) {
      toast.error('Please select at least one service');
      return;
    }

    if (!formData.city || !formData.province) {
      toast.error('Please enter your city and province');
      return;
    }

    try {
      setSubmitting(true);

      const submitData = new FormData();
      submitData.append('bio', formData.bio.trim());
      submitData.append('experience_years', formData.experience_years.toString());
      submitData.append('city', formData.city.trim());
      submitData.append('province', formData.province.trim());
      submitData.append('address', formData.address.trim());
      submitData.append('services', JSON.stringify(formData.services));
      submitData.append('languages', JSON.stringify(formData.languages));

      if (profileImage) {
        submitData.append('image', profileImage);
      }

      console.log('=== SUBMITTING PROFILE ===');
      console.log('Bio:', formData.bio);
      console.log('Experience:', formData.experience_years);
      console.log('Services:', formData.services);
      console.log('Languages:', formData.languages);
      console.log('City:', formData.city);
      console.log('Province:', formData.province);
      
      const response = await apiClient.put('/profiles/worker', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('=== RESPONSE RECEIVED ===');
      console.log('Full response:', response);
      console.log('Profile picture in response:', response.data?.profile_picture);
      
      // apiClient interceptor returns response.data, so response IS the data
      // Check: response.success (not response.data.success)
      if (response.success) {
        console.log('✅ Profile updated successfully');
        toast.success('Worker profile updated successfully!', {
          duration: 3000,
          position: 'top-center'
        });
        
        // Update user in store if profile picture was changed
        if (response.data?.profile_picture) {
          setUser({ ...user, profile_picture: response.data.profile_picture });
        }
        
        // Navigate to profile after a short delay
        setTimeout(() => {
          router.push('/dashboard/worker-profile');
        }, 1000);
      } else {
        throw new Error(response.message || 'Update failed');
      }

    } catch (error) {
      console.error('❌ Submit error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-800">Edit Worker Profile</h1>
          <p className="text-gray-600 mt-2">Complete your profile to attract more customers</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Profile Picture */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Profile Picture</h2>
            
            <div className="flex items-center gap-6">
              <div className="relative">
                <img
                  src={imagePreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.full_name || 'Worker')}&size=128&background=10b981&color=fff`}
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-200"
                />
              </div>
              
              <div>
                <label className="block">
                  <span className="sr-only">Choose profile photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">JPG, PNG or GIF (Max 5MB)</p>
              </div>
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Professional Bio</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tell customers about yourself *
              </label>
              <textarea
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Describe your experience, skills, and what makes you stand out..."
                required
              />
              <p className="text-sm text-gray-500 mt-1">Minimum 20 characters</p>
            </div>
          </div>

          {/* Experience */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Experience</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Years of Experience *
              </label>
              <input
                type="number"
                name="experience_years"
                value={formData.experience_years}
                onChange={handleInputChange}
                min="0"
                max="50"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="e.g., 5"
                required
              />
            </div>
          </div>

          {/* Services */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Services Offered *</h2>
            
            <p className="text-sm text-gray-600 mb-4">Select all services you can provide</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.services.includes(category.id)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.services.includes(category.id)}
                    onChange={() => handleServiceToggle(category.id)}
                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{category.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Languages */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Languages</h2>
            
            <p className="text-sm text-gray-600 mb-4">Select languages you speak</p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {languageOptions.map((language) => (
                <label
                  key={language}
                  className={`flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                    formData.languages.includes(language)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.languages.includes(language)}
                    onChange={() => handleLanguageToggle(language)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{language}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Service Location *</h2>
            
            <div className="space-y-4">
              <CitySelector
                selectedCity={formData.city}
                selectedProvince={formData.province}
                
				onCityChange={(city) => {
                  console.log('City changed:', city);
                  setFormData(prev => {
                    const updated = { ...prev, city: city };
                    console.log('Updated formData:', updated);
                    return updated;
                  });
                }}
                onProvinceChange={(province) => {
                  console.log('Province changed:', province);
                  setFormData(prev => {
                    const updated = { ...prev, province: province };
                    console.log('Updated formData:', updated);
                    return updated;
                  });
                }}
				
				
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Complete Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="House/Street/Area details"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Profile'}
            </button>
            
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="px-8 py-3 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}