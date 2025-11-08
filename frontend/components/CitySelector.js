// frontend/components/CitySelector.js
import { useState, useEffect, useRef } from 'react';
import { FiSearch, FiMapPin, FiChevronDown, FiRefreshCw } from 'react-icons/fi';

export default function CitySelector({ selectedCity, selectedProvince, onCityChange, onProvinceChange, error }) {
  const [cities, setCities] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [filteredCities, setFilteredCities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchProvinces();
    fetchCities();
  }, []);

  useEffect(() => {
    if (selectedCity && cities.length > 0) {
      setSearchTerm(selectedCity);
    }
  }, [selectedCity, cities]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchProvinces = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/provinces`);
      const data = await response.json();
      if (data.success) {
        setProvinces(data.data);
      }
    } catch (error) {
      console.error('Error fetching provinces:', error);
    }
  };

  const fetchCities = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/locations/cities`);
      const data = await response.json();
      if (data.success) {
        setCities(data.data);
        setFilteredCities(data.data);
      }
    } catch (error) {
      console.error('Error fetching cities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchCities(true);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setIsOpen(true);

    if (!value.trim()) {
      setFilteredCities(cities);
      return;
    }

    const filtered = cities.filter(city =>
      city.name.toLowerCase().includes(value.toLowerCase())
    );
    setFilteredCities(filtered);
  };

  const handleCitySelect = async (city) => {
    setSearchTerm(city.name);
    setIsOpen(false);
    onCityChange(city.name);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/locations/cities/${encodeURIComponent(city.name)}/province`
      );
      const data = await response.json();
      if (data.success && data.data.province) {
        onProvinceChange(data.data.province.name);
      }
    } catch (error) {
      console.error('Error fetching province:', error);
    }
  };

  const getProvinceName = (provinceId) => {
    const province = provinces.find(p => p.id === provinceId);
    return province ? province.name : '';
  };

  return (
    <div className="space-y-4">
      <div className="relative" ref={dropdownRef}>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700">
            City <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <FiRefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => setIsOpen(true)}
            placeholder="Search for your city..."
            className={`w-full pl-10 pr-10 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <FiChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
          </div>
        </div>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading cities...</div>
            ) : filteredCities.length > 0 ? (
              <ul>
                {filteredCities.map((city, index) => (
                  <li
                    key={index}
                    onClick={() => handleCitySelect(city)}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between border-b last:border-b-0"
                  >
                    <span className="font-medium text-gray-800">{city.name}</span>
                    <span className="text-sm text-gray-500">{getProvinceName(city.province)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4 text-center text-gray-500">No cities found</div>
            )}
          </div>
        )}

        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Province / Territory
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FiMapPin className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={selectedProvince}
            readOnly
            placeholder="Auto-selected based on city"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  );
}