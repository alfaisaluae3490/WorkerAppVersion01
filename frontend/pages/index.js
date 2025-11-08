// frontend/pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { FiSearch, FiMapPin, FiStar, FiShield, FiClock, FiTrendingUp } from 'react-icons/fi';
import useAuthStore from '../store/authStore';

export default function Home() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // If authenticated, redirect based on role
    if (isAuthenticated && user) {
      if (user.role === 'worker' || user.role === 'both') {
        router.push('/dashboard/worker');
      } else {
        router.push('/dashboard/customer');
      }
    }
  }, [isAuthenticated, user, router]);

  return (
    <>
      <Head>
        <title>Services Marketplace - Find Local Services & Workers</title>
        <meta name="description" content="Connect with trusted local service providers for any job" />
      </Head>

      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-600 text-white">
          <div className="container mx-auto px-4 py-20">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-6">
                Find Trusted Local Services
              </h1>
              <p className="text-xl md:text-2xl text-primary-100 mb-8">
                Connect with verified professionals for any on-site service
              </p>

              {/* Search Bar */}
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-3xl mx-auto">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="What service do you need?"
                      className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <FiMapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="City or location"
                      className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <button className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors">
                    Search
                  </button>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <button className="bg-white text-primary-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                    Get Started as Customer
                  </button>
                </Link>
                <Link href="/signup">
                  <button className="bg-secondary-500 text-white px-8 py-4 rounded-lg font-semibold hover:bg-secondary-600 transition-colors">
                    Offer Your Services
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
              Why Choose Us?
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              The safest and most reliable way to find local services
            </p>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* Feature 1 */}
              <div className="card text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                  <FiShield className="text-primary-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Verified Professionals</h3>
                <p className="text-gray-600">
                  All workers are ID-verified with ratings and reviews from real customers
                </p>
              </div>

              {/* Feature 2 */}
              <div className="card text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <FiStar className="text-green-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Live Bidding System</h3>
                <p className="text-gray-600">
                  Post your job and get competitive bids from multiple professionals
                </p>
              </div>

              {/* Feature 3 */}
              <div className="card text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
                  <FiClock className="text-purple-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Fast & Easy Booking</h3>
                <p className="text-gray-600">
                  Book services in minutes with secure in-app chat and payment
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600 text-center mb-12">
              Get your job done in 3 simple steps
            </p>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {/* Step 1 */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full text-2xl font-bold mb-4">
                  1
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Post Your Job</h3>
                <p className="text-gray-600">
                  Describe what you need with photos, location, and budget
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full text-2xl font-bold mb-4">
                  2
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Review Bids</h3>
                <p className="text-gray-600">
                  Compare offers from verified workers and choose the best one
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 text-white rounded-full text-2xl font-bold mb-4">
                  3
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Get It Done</h3>
                <p className="text-gray-600">
                  Chat, schedule, and complete the job with full support
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <Link href="/signup">
                <button className="btn-primary text-lg px-10 py-4">
                  Post Your First Job Free
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Popular Categories */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
              Popular Services
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
              {[
                { name: 'Plumbing', icon: '🔧' },
                { name: 'Electrical', icon: '⚡' },
                { name: 'Cleaning', icon: '🧹' },
                { name: 'Carpentry', icon: '🔨' },
                { name: 'Painting', icon: '🎨' },
                { name: 'Gardening', icon: '🌱' },
                { name: 'Moving', icon: '📦' },
                { name: 'AC Repair', icon: '❄️' },
                { name: 'Appliances', icon: '🔌' },
                { name: 'Handyman', icon: '🛠️' },
                { name: 'Locksmith', icon: '🔐' },
                { name: 'Pest Control', icon: '🐛' },
              ].map((category, index) => (
                <button
                  key={index}
                  className="bg-white border-2 border-gray-200 hover:border-primary-600 hover:bg-primary-50 rounded-xl p-6 text-center transition-all group"
                >
                  <div className="text-4xl mb-2">{category.icon}</div>
                  <div className="font-semibold text-gray-800 group-hover:text-primary-600">
                    {category.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-20 bg-gradient-to-r from-primary-600 to-secondary-600 text-white">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8 max-w-5xl mx-auto text-center">
              <div>
                <div className="text-5xl font-bold mb-2">10K+</div>
                <div className="text-primary-100">Verified Workers</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">50K+</div>
                <div className="text-primary-100">Jobs Completed</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">4.8</div>
                <div className="text-primary-100">Average Rating</div>
              </div>
              <div>
                <div className="text-5xl font-bold mb-2">100+</div>
                <div className="text-primary-100">Cities Covered</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers and workers on our platform
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <button className="btn-primary text-lg px-10 py-4">
                  Sign Up Now
                </button>
              </Link>
              <Link href="/login">
                <button className="btn-outline text-lg px-10 py-4">
                  Login
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-gray-900 text-gray-300 py-12">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-4 gap-8">
              <div>
                <h3 className="text-white text-xl font-bold mb-4">Services Marketplace</h3>
                <p className="text-sm">
                  Your trusted platform for local on-site services
                </p>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">For Customers</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/how-it-works" className="hover:text-white">How It Works</Link></li>
                  <li><Link href="/post-job" className="hover:text-white">Post a Job</Link></li>
                  <li><Link href="/browse-workers" className="hover:text-white">Browse Workers</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">For Workers</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/worker-signup" className="hover:text-white">Become a Worker</Link></li>
                  <li><Link href="/find-jobs" className="hover:text-white">Find Jobs</Link></li>
                  <li><Link href="/worker-resources" className="hover:text-white">Resources</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/about" className="hover:text-white">About Us</Link></li>
                  <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                  <li><Link href="/terms" className="hover:text-white">Terms of Service</Link></li>
                  <li><Link href="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
              <p>&copy; 2025 Services Marketplace. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}