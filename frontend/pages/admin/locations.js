// frontend/pages/admin/locations.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiPlus, FiEdit2, FiTrash2, FiArrowLeft, FiSave, FiX, FiMap, FiMapPin } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function AdminLocations() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('provinces'); // 'provinces' or 'cities'
  
  // Provinces
  const [provinces, setProvinces] = useState([]);
  const [showProvinceModal, setShowProvinceModal] = useState(false);
  const [editingProvince, setEditingProvince] = useState(null);
  const [provinceForm, setProvinceForm] = useState({ id: '', name: '', capital: '' });

  // Cities
  const [cities, setCities] = useState([]);
  const [showCityModal, setShowCityModal] = useState(false);
  const [editingCity, setEditingCity] = useState(null);
  const [cityForm, setCityForm] = useState({ name: '', province_id: '' });
  const [selectedProvince, setSelectedProvince] = useState('');

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (!token || !isAuthenticated || user?.role !== 'admin') {
      toast.error('Access denied');
      router.push('/login');
      return;
    }

    fetchProvinces();
    fetchCities();
  }, [isAuthenticated, user]);

  const fetchProvinces = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/locations/provinces`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setProvinces(data.data.provinces);
      }
    } catch (error) {
      toast.error('Failed to load provinces');
    } finally {
      setLoading(false);
    }
  };

  const fetchCities = async (provinceId = '') => {
    try {
      const token = localStorage.getItem('token');
      const url = provinceId 
        ? `${API_URL}/admin/locations/cities?province_id=${provinceId}`
        : `${API_URL}/admin/locations/cities`;
      
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setCities(data.data.cities);
      }
    } catch (error) {
      toast.error('Failed to load cities');
    }
  };

  // Province handlers
  const handleProvinceSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingProvince 
        ? `${API_URL}/admin/locations/provinces/${editingProvince.id}`
        : `${API_URL}/admin/locations/provinces`;
      
      const method = editingProvince ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(provinceForm)
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingProvince ? 'Province updated' : 'Province created');
        closeProvinceModal();
        fetchProvinces();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleEditProvince = (province) => {
    setEditingProvince(province);
    setProvinceForm({
      id: province.id,
      name: province.name,
      capital: province.capital || ''
    });
    setShowProvinceModal(true);
  };

  const handleDeleteProvince = async (id) => {
    if (!confirm('Delete this province? All cities in this province will also be deleted.')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/locations/provinces/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Province deleted');
        fetchProvinces();
        fetchCities();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to delete province');
    }
  };

  const closeProvinceModal = () => {
    setShowProvinceModal(false);
    setEditingProvince(null);
    setProvinceForm({ id: '', name: '', capital: '' });
  };

  // City handlers
  const handleCitySubmit = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const url = editingCity 
        ? `${API_URL}/admin/locations/cities/${editingCity.id}`
        : `${API_URL}/admin/locations/cities`;
      
      const method = editingCity ? 'PATCH' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cityForm)
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingCity ? 'City updated' : 'City created');
        closeCityModal();
        fetchCities(selectedProvince);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleEditCity = (city) => {
    setEditingCity(city);
    setCityForm({
      name: city.name,
      province_id: city.province_id
    });
    setShowCityModal(true);
  };

  const handleDeleteCity = async (id) => {
    if (!confirm('Delete this city?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/admin/locations/cities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await res.json();

      if (data.success) {
        toast.success('City deleted');
        fetchCities(selectedProvince);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error('Failed to delete city');
    }
  };

  const closeCityModal = () => {
    setShowCityModal(false);
    setEditingCity(null);
    setCityForm({ name: '', province_id: '' });
  };

  const handleProvinceFilter = (provinceId) => {
    setSelectedProvince(provinceId);
    fetchCities(provinceId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Manage Locations - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <Link href="/admin/dashboard">
                  <button className="p-2 hover:bg-gray-100 rounded-lg">
                    <FiArrowLeft className="w-5 h-5" />
                  </button>
                </Link>
                <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
              </div>
              <button
                onClick={() => activeTab === 'provinces' ? setShowProvinceModal(true) : setShowCityModal(true)}
                className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600"
              >
                <FiPlus /> Add {activeTab === 'provinces' ? 'Province' : 'City'}
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mt-4 border-b">
              <button
                onClick={() => setActiveTab('provinces')}
                className={`pb-2 px-1 ${activeTab === 'provinces' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500'}`}
              >
                <FiMap className="inline mr-2" />
                Provinces
              </button>
              <button
                onClick={() => setActiveTab('cities')}
                className={`pb-2 px-1 ${activeTab === 'cities' ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500'}`}
              >
                <FiMapPin className="inline mr-2" />
                Cities
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'provinces' ? (
            // Provinces Table
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Capital</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cities</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {provinces.map((province) => (
                    <tr key={province.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{province.id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{province.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{province.capital}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{province.cities_count || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEditProvince(province)}
                          className="text-orange-600 hover:text-orange-900 mr-4"
                        >
                          <FiEdit2 className="w-4 h-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDeleteProvince(province.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 className="w-4 h-4 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {provinces.length === 0 && (
                <div className="text-center py-12 text-gray-500">No provinces found.</div>
              )}
            </div>
          ) : (
            // Cities Table
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Province</label>
                <select
                  value={selectedProvince}
                  onChange={(e) => handleProvinceFilter(e.target.value)}
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">All Provinces</option>
                  {provinces.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Province</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {cities.map((city) => (
                      <tr key={city.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{city.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{city.province_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleEditCity(city)}
                            className="text-orange-600 hover:text-orange-900 mr-4"
                          >
                            <FiEdit2 className="w-4 h-4 inline" />
                          </button>
                          <button
                            onClick={() => handleDeleteCity(city.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <FiTrash2 className="w-4 h-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cities.length === 0 && (
                  <div className="text-center py-12 text-gray-500">No cities found.</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Province Modal */}
      {showProvinceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingProvince ? 'Edit' : 'Add'} Province</h2>
              <button onClick={closeProvinceModal} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleProvinceSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ID *</label>
                <input
                  type="text"
                  value={provinceForm.id}
                  onChange={(e) => setProvinceForm({ ...provinceForm, id: e.target.value })}
                  required
                  disabled={editingProvince}
                  placeholder="punjab"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={provinceForm.name}
                  onChange={(e) => setProvinceForm({ ...provinceForm, name: e.target.value })}
                  required
                  placeholder="Punjab"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capital</label>
                <input
                  type="text"
                  value={provinceForm.capital}
                  onChange={(e) => setProvinceForm({ ...provinceForm, capital: e.target.value })}
                  placeholder="Lahore"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2"
                >
                  <FiSave /> {editingProvince ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={closeProvinceModal}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* City Modal */}
      {showCityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{editingCity ? 'Edit' : 'Add'} City</h2>
              <button onClick={closeCityModal} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCitySubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City Name *</label>
                <input
                  type="text"
                  value={cityForm.name}
                  onChange={(e) => setCityForm({ ...cityForm, name: e.target.value })}
                  required
                  placeholder="Lahore"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                <select
                  value={cityForm.province_id}
                  onChange={(e) => setCityForm({ ...cityForm, province_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">Select Province</option>
                  {provinces.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2"
                >
                  <FiSave /> {editingCity ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={closeCityModal}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}