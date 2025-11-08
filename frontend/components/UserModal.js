// frontend/components/UserModal.js - WITH PASSWORD RESET
import { useState, useEffect } from 'react';
import { FiX, FiUpload, FiInfo, FiLock } from 'react-icons/fi';
import CitySelector from './CitySelector';
import toast from 'react-hot-toast';

export default function UserModal({ isOpen, onClose, user, onSuccess }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'customer',
    password: '',
    address: '',
    city: '',
    province: '',
    bio: '',
    // Worker-specific fields
    experience_years: '',
    hourly_rate: '',
    gender: '',
    services: [],
    languages: []
  });
  
  const [profileImage, setProfileImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(false);
  
  // Password reset states
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  const languageOptions = ['English', 'Urdu', 'Punjabi', 'Sindhi', 'Pashto', 'Balochi', 'Saraiki'];
  const genderOptions = ['male', 'female', 'other', 'prefer_not_to_say'];

  // Fetch categories when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  // Fetch user details when editing
  useEffect(() => {
    if (isOpen && user) {
      fetchUserDetails(user.id);
    } else if (isOpen && !user) {
      resetForm();
    }
  }, [user, isOpen]);

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      role: 'customer',
      password: '',
      address: '',
      city: '',
      province: '',
      bio: '',
      experience_years: '',
      hourly_rate: '',
      gender: '',
      services: [],
      languages: []
    });
    setImagePreview('');
    setError('');
    setProfileImage(null);
    setShowPasswordReset(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const fetchUserDetails = async (userId) => {
    try {
      setLoadingUserData(true);
      const response = await fetch(`http://localhost:5000/api/admin/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        const userData = data.data.user;
        console.log('Fetched user data:', userData);
        console.log('City from backend:', userData.city);
        console.log('Province from backend:', userData.province);
        
        setFormData({
          full_name: userData.full_name || '',
          email: userData.email || '',
          phone: userData.phone || '',
          role: userData.role || 'customer',
          password: '',
          address: userData.address || '',
          city: userData.city || '',
          province: userData.province || '',
          bio: userData.bio || userData.worker_bio || '',
          experience_years: userData.experience_years || '',
          hourly_rate: userData.hourly_rate || '',
          gender: userData.gender || '',
          services: Array.isArray(userData.services) ? userData.services : [],
          languages: Array.isArray(userData.languages) ? userData.languages : []
        });
        console.log('Form data city set to:', userData.city);
        console.log('Form data province set to:', userData.province);
        setImagePreview(userData.profile_picture || '');
      }
    } catch (err) {
      console.error('Failed to fetch user details:', err);
      setError('Failed to load user details');
    } finally {
      setLoadingUserData(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await fetch('http://localhost:5000/api/categories');
      const data = await response.json();
      if (data.success) {
        setCategories(data.data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setProfileImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const toggleService = (serviceName) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(serviceName)
        ? prev.services.filter(s => s !== serviceName)
        : [...prev.services, serviceName]
    }));
  };

  const toggleLanguage = (lang) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const handlePasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setResettingPassword(true);
      const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}/reset-password`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_password: newPassword })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Password reset successfully!');
        setShowPasswordReset(false);
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.message || 'Failed to reset password');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      toast.error('Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (user) {
        // ============================================
        // UPDATE EXISTING USER
        // ============================================
        
        // Step 1: Update basic user info with image
        const formDataToSend = new FormData();
        formDataToSend.append('full_name', formData.full_name);
        formDataToSend.append('email', formData.email);
        formDataToSend.append('phone', formData.phone);
        formDataToSend.append('role', formData.role);
        formDataToSend.append('address', formData.address);
        formDataToSend.append('city', formData.city);
        formDataToSend.append('province', formData.province);
        formDataToSend.append('bio', formData.bio);
        
        if (profileImage) {
          formDataToSend.append('image', profileImage);
        }

        const response = await fetch(`http://localhost:5000/api/admin/users/${user.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formDataToSend
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        // Step 2: Update worker profile if role is worker or both
        if (formData.role === 'worker' || formData.role === 'both') {
          const workerData = {
            bio: formData.bio,
            experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
            hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
            gender: formData.gender || null,
            address: formData.address,
            city: formData.city,
            province: formData.province,
            services: formData.services,
            languages: formData.languages
          };

          console.log('Updating worker profile with:', workerData);

          const workerResponse = await fetch(`http://localhost:5000/api/admin/users/${user.id}/worker-profile`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(workerData)
          });

          const workerResult = await workerResponse.json();
          if (!workerResult.success) {
            console.error('Worker profile update error:', workerResult);
            throw new Error(workerResult.message || 'Failed to update worker profile');
          }

          console.log('Worker profile updated successfully');
        }

        toast.success('User updated successfully!');

      } else {
        // ============================================
        // CREATE NEW USER
        // ============================================
        
		
		
		
		
const createFormData = new FormData();
        createFormData.append('full_name', formData.full_name);
        createFormData.append('email', formData.email);
        createFormData.append('phone', formData.phone);
        createFormData.append('role', formData.role);
        createFormData.append('password', formData.password);
        createFormData.append('address', formData.address || '');
        createFormData.append('city', formData.city || '');
        createFormData.append('province', formData.province || '');
        createFormData.append('bio', formData.bio || '');
        
        if (profileImage) {
          createFormData.append('image', profileImage);
        }
        
        console.log('Creating user - City:', formData.city, 'Province:', formData.province);

        const response = await fetch('http://localhost:5000/api/admin/users/create', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: createFormData
        });
		
		
		
		
		

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        // Update worker profile if role is worker or both
        if (formData.role === 'worker' || formData.role === 'both') {
          const workerData = {
            bio: formData.bio,
            experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
            hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
            gender: formData.gender || null,
            address: formData.address,
            city: formData.city,
            province: formData.province,
            services: formData.services,
            languages: formData.languages
          };

          await fetch(`http://localhost:5000/api/admin/users/${data.data.user.id}/worker-profile`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(workerData)
          });
        }

        toast.success('User created successfully!');
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isWorkerRole = formData.role === 'worker' || formData.role === 'both';

  // Field Badge Component
  const FieldBadge = ({ type }) => {
    if (type === 'both') {
      return (
        <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded">
          All Roles
        </span>
      );
    }
    if (type === 'worker') {
      return (
        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
          Worker Only
        </span>
      );
    }
    return null;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-5xl w-full my-8">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10 rounded-t-lg">
          <div>
            <h2 className="text-xl font-bold">{user ? 'Edit User' : 'Add New User'}</h2>
            <p className="text-sm text-gray-500 mt-1">
              <FiInfo className="inline mr-1" />
              Fields are marked for Customer, Worker, or Both roles
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <FiX size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-120px)] overflow-y-auto">
          {loadingUserData ? (
            <div className="p-12 text-center text-gray-500">
              Loading user data...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Password Reset Section - Only show when editing */}
              {user && (
                <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold flex items-center text-orange-900">
                      <FiLock className="mr-2" />
                      Password Management
                    </h3>
                    {!showPasswordReset && (
                      <button
                        type="button"
                        onClick={() => setShowPasswordReset(true)}
                        className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                      >
                        Reset Password
                      </button>
                    )}
                  </div>

                  {showPasswordReset && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          New Password *
                        </label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Min 6 characters"
                          minLength={6}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Confirm Password *
                        </label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          placeholder="Re-enter password"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handlePasswordReset}
                          disabled={resettingPassword}
                          className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                          {resettingPassword ? 'Resetting...' : 'Confirm Reset'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordReset(false);
                            setNewPassword('');
                            setConfirmPassword('');
                          }}
                          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Profile Picture */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-semibold mb-3 flex items-center">
                  Profile Picture
                  <FieldBadge type="both" />
                </h3>
                <div className="flex items-center gap-4">
                  <img
                    src={imagePreview || `https://ui-avatars.com/api/?name=${encodeURIComponent(formData.full_name || 'User')}&size=128`}
                    alt="Profile"
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                  <div className="flex-1">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100">
                      <FiUpload />
                      Choose File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-500 mt-1">JPG, PNG or GIF (Max 5MB)</p>
                  </div>
                </div>
              </div>

              {/* Basic Information */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  Basic Information
                  <FieldBadge type="both" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="+92xxxxxxxxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Role *
                    </label>
                    <select
                      required
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="customer">Customer</option>
                      <option value="worker">Worker</option>
                      <option value="both">Both (Customer + Worker)</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  {!user && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        required={!user}
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        minLength={6}
                        placeholder="Min 6 characters"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Location Information */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  Location
                  <FieldBadge type="both" />
                </h3>
                <div className="space-y-4">
                  <CitySelector
                    selectedCity={formData.city}
                    selectedProvince={formData.province}
                   onCityChange={(city) => {
                      console.log('Admin modal - City changed to:', city);
                      setFormData(prev => ({ ...prev, city: city }));
                    }}
                    onProvinceChange={(province) => {
                      console.log('Admin modal - Province changed to:', province);
                      setFormData(prev => ({ ...prev, province: province }));
                    }}
                  />
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Complete Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="2"
                      placeholder="House/Street/Area details"
                    />
                  </div>
                </div>
              </div>

              {/* Bio / About */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center">
                  Bio / About
                  <FieldBadge type="both" />
                </h3>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  placeholder="Tell about yourself..."
                />
              </div>

              {/* Worker-Specific Fields */}
              {isWorkerRole && (
                <>
                  {/* Worker Details */}
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="font-semibold mb-3 flex items-center text-blue-900">
                      Worker Details
                      <FieldBadge type="worker" />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Experience Years
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={formData.experience_years}
                          onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., 5"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Hourly Rate (PKR)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.hourly_rate}
                          onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="e.g., 500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Gender
                        </label>
                        <select
                          value={formData.gender}
                          onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select Gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Services */}
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="font-semibold mb-3 flex items-center text-blue-900">
                      Services Offered
                      <FieldBadge type="worker" />
                    </h3>
                    {loadingCategories ? (
                      <p className="text-gray-500">Loading services...</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {categories.map((category) => (
                          <label
                            key={category.id}
                            className={`flex items-center gap-2 p-2 border-2 rounded cursor-pointer transition-colors ${
                              formData.services.includes(category.name)
                                ? 'bg-blue-200 border-blue-400'
                                : 'bg-white border-gray-200 hover:bg-blue-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.services.includes(category.name)}
                              onChange={() => toggleService(category.name)}
                              className="rounded"
                            />
                            <span className="text-sm">{category.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-blue-700 mt-2 font-medium">
                      Selected: {formData.services.length} service(s)
                    </p>
                  </div>

                  {/* Languages */}
                  <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="font-semibold mb-3 flex items-center text-blue-900">
                      Languages
                      <FieldBadge type="worker" />
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {languageOptions.map((lang) => (
                        <label
                          key={lang}
                          className={`flex items-center gap-2 p-2 border-2 rounded cursor-pointer transition-colors ${
                            formData.languages.includes(lang)
                              ? 'bg-blue-200 border-blue-400'
                              : 'bg-white border-gray-200 hover:bg-blue-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formData.languages.includes(lang)}
                            onChange={() => toggleLanguage(lang)}
                            className="rounded"
                          />
                          <span className="text-sm">{lang}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-blue-700 mt-2 font-medium">
                      Selected: {formData.languages.length} language(s)
                    </p>
                  </div>
                </>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (user ? 'Update User' : 'Create User')}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}