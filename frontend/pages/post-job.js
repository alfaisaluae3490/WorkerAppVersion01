// frontend/pages/post-job.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { 
  FiUpload, 
  FiX, 
  FiMapPin, 
  FiDollarSign, 
  FiCalendar,
  FiClock,
  FiAlertCircle,
  FiArrowLeft
} from 'react-icons/fi';
import useAuthStore from '../store/authStore';
import { jobsAPI, categoriesAPI } from '../utils/apiClient';
import toast from 'react-hot-toast';
import CitySelector from '../components/CitySelector';

export default function PostJob() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    budget_min: '',
    budget_max: '',
    location_address: '',
    city: '',
    province: '',
    preferred_date: '',
    preferred_time: '',
    requires_verification: false,
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoriesAPI.getCategories();
      if (response.success) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error("Failed to load categories");
    }
  };

  // Categories (fallback if API fails)
  const fallbackCategories = [
    'Plumbing', 'Electrical', 'Cleaning', 'Carpentry', 'Painting',
    'Gardening', 'Moving', 'AC Repair', 'Appliance Repair', 'Handyman',
    'Locksmith', 'Pest Control', 'Roofing', 'Flooring', 'Masonry'
  ];

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      toast.error('Please login to post a job');
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  // City change handler
  const handleCityChange = (city) => {
    setFormData(prev => ({ ...prev, city }));
  };

  // Province change handler
  const handleProvinceChange = (province) => {
    setFormData(prev => ({ ...prev, province }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (images.length + files.length > 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setImages([...images, ...files]);

    // Create previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviews((prev) => [...prev, reader.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title || formData.title.length < 5) {
      toast.error('Title must be at least 5 characters');
      return;
    }

    if (!formData.description || formData.description.length < 20) {
      toast.error('Description must be at least 20 characters');
      return;
    }

    if (!formData.category_id) {
      toast.error('Please select a category');
      return;
    }

    if (!formData.budget_min || !formData.budget_max) {
      toast.error('Please enter budget range');
      return;
    }

    if (parseInt(formData.budget_min) > parseInt(formData.budget_max)) {
      toast.error('Minimum budget cannot be greater than maximum');
      return;
    }

    if (!formData.location_address || formData.location_address.trim().length < 5) {
      toast.error('Please enter your complete address (minimum 5 characters)');
      return;
    }

    if (!formData.city || formData.city.trim() === '') {
      toast.error('Please select a city');
      return;
    }

    if (!formData.province || formData.province.trim() === '') {
      toast.error('Please select city first, province will be set automatically');
      return;
    }

    setLoading(true);

    try {
      // Upload images to Cloudinary first if any
      let uploadedImages = [];
      
      if (images.length > 0) {
        // Check if Cloudinary is configured
        if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) {
          console.warn('Cloudinary not configured, skipping image upload');
          toast('Image upload skipped - Cloudinary not configured', { icon: '⚠️' });
        } else {
          toast.loading('Uploading images...');
          
          try {
            const uploadPromises = images.map(async (image) => {
              const formDataImage = new FormData();
              formDataImage.append('file', image);
              formDataImage.append('upload_preset', 'gworkerapp');

              const response = await fetch(
                `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
                {
                  method: 'POST',
                  body: formDataImage,
                }
              );

              if (!response.ok) {
                console.error('Cloudinary upload failed:', await response.text());
                return null;
              }

              const data = await response.json();
              return data.secure_url;
            });

            const results = await Promise.all(uploadPromises);
            uploadedImages = results.filter(url => url !== null);
            toast.dismiss();
            
            if (uploadedImages.length < images.length) {
             toast.error(`${images.length - uploadedImages.length} image(s) failed to upload`);
            }
          } catch (uploadError) {
            console.error('Image upload error:', uploadError);
            toast.dismiss();
            toast('Failed to upload images, posting job without images', { icon: '⚠️' });
            uploadedImages = [];
          }
        }
      }

      // Create job with uploaded image URLs (or empty array)
      const jobData = {
        title: formData.title,
        description: formData.description,
        category_id: formData.category_id,
        budget_min: formData.budget_min,
        budget_max: formData.budget_max,
        city: formData.city,
        province: formData.province,
        location_address: formData.location_address,
        preferred_date: formData.preferred_date || null,
        preferred_time: formData.preferred_time || null,
        requires_verification: formData.requires_verification,
        images: uploadedImages,
      };

      const response = await jobsAPI.createJob(jobData);

      if (response.success) {
        toast.success('Job posted successfully!');
        router.push('/dashboard/customer');
      } else {
        toast.error(response.message || 'Failed to post job');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.response?.data?.message || 'Failed to post job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Post a Job - Services Marketplace</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16">
              <Link href="/">
                <h1 className="text-2xl font-bold text-primary-600 cursor-pointer">
                  Services Marketplace
                </h1>
              </Link>

              <div className="flex items-center gap-4">
                <Link href="/dashboard/customer">
                  <button className="text-gray-700 hover:text-primary-600 font-medium">
                    Dashboard
                  </button>
                </Link>
                <Link href="/profile">
                  <button className="text-gray-700 hover:text-primary-600 font-medium">
                    Profile
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            {/* Back Button */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
            >
              <FiArrowLeft />
              <span>Back</span>
            </button>

            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Post a New Job</h1>
              <p className="text-gray-600">
                Describe your job requirements and connect with skilled workers
              </p>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
              <form onSubmit={handleSubmit}>
                {/* Job Title */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g., Need a plumber to fix kitchen sink"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.title.length}/100 characters
                  </p>
                </div>

                {/* Category */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="category_id"
                    value={formData.category_id}
                    onChange={handleChange}
                    className="input-field"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      fallbackCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    className="input-field min-h-[150px]"
                    placeholder="Describe what needs to be done, any specific requirements, materials needed, etc."
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.description.length} characters (minimum 20)
                  </p>
                </div>

                {/* Images Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Images (Optional)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Upload images to help workers understand the job better (max 5)
                  </p>

                  {/* Image Previews */}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <FiX size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Button */}
                  {imagePreviews.length < 5 && (
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                      <FiUpload className="text-gray-400 mb-2" size={32} />
                      <span className="text-sm text-gray-600">
                        Click to upload images ({imagePreviews.length}/5)
                      </span>
                      <span className="text-xs text-gray-500 mt-1">
                        PNG, JPG up to 5MB each
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Budget */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Budget Range (PKR) <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiDollarSign className="text-gray-400" size={18} />
                        </div>
                        <input
                          type="number"
                          name="budget_min"
                          value={formData.budget_min}
                          onChange={handleChange}
                          className="input-field pl-10"
                          placeholder="Minimum"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Minimum budget</p>
                    </div>
                    <div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiDollarSign className="text-gray-400" size={18} />
                        </div>
                        <input
                          type="number"
                          name="budget_max"
                          value={formData.budget_max}
                          onChange={handleChange}
                          className="input-field pl-10"
                          placeholder="Maximum"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Maximum budget</p>
                    </div>
                  </div>
                </div>

                {/* Location Section */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Job Location <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="space-y-4">
                    {/* Complete Address - MANDATORY */}
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">
                        Complete Address <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMapPin className="text-gray-400" size={18} />
                        </div>
                        <input
                          type="text"
                          name="location_address"
                          value={formData.location_address}
                          onChange={handleChange}
                          className="input-field pl-10"
                          placeholder="Enter your complete address (e.g., House #123, Street 5, Block A)"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Provide complete address so workers can find your location easily
                      </p>
                    </div>

                    {/* City Selector Component */}
                    <CitySelector
                      selectedCity={formData.city}
                      selectedProvince={formData.province}
                      onCityChange={handleCityChange}
                      onProvinceChange={handleProvinceChange}
                    />
                  </div>
                </div>

                {/* Preferred Date & Time */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Preferred Date & Time (Optional)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiCalendar className="text-gray-400" size={18} />
                      </div>
                      <input
                        type="date"
                        name="preferred_date"
                        value={formData.preferred_date}
                        onChange={handleChange}
                        className="input-field pl-10"
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiClock className="text-gray-400" size={18} />
                      </div>
                      <input
                        type="time"
                        name="preferred_time"
                        value={formData.preferred_time}
                        onChange={handleChange}
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Preferences */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Additional Preferences
                  </label>
                  
                  <div className="space-y-3">
                    {/* Verified Workers Only */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="requires_verification"
                        checked={formData.requires_verification}
                        onChange={handleChange}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">
                        Require verified workers only
                      </span>
                    </label>
                  </div>
                </div>

                {/* Important Notice */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex gap-3">
                  <FiAlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Workers will be able to bid on your job once posted</li>
                      <li>You can review and compare bids before selecting a worker</li>
                      <li>Chat will unlock after accepting a bid</li>
                      <li>Payment will be handled through our secure platform</li>
                    </ul>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? 'Posting...' : 'Post Job'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        .input-field {
          @apply w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent;
        }
      `}</style>
    </>
  );
}