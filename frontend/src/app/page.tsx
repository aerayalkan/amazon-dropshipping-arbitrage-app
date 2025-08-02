import Link from 'next/link'
import { 
  ChartBarIcon, 
  CubeIcon, 
  CurrencyDollarIcon, 
  BoltIcon,
  CpuChipIcon,
  PresentationChartBarIcon 
} from '@heroicons/react/24/outline'

const features = [
  {
    name: 'Product Research',
    description: 'AI-powered product discovery and market analysis with real-time Amazon data.',
    icon: CubeIcon,
    href: '/products',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    name: 'Inventory Management',
    description: 'Automated inventory tracking and dropshipping workflow management.',
    icon: ChartBarIcon,
    href: '/inventory',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    name: 'Pricing Calculator',
    description: 'Advanced profit calculation with real-time cost analysis and optimization.',
    icon: CurrencyDollarIcon,
    href: '/pricing',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  {
    name: 'Repricing Engine',
    description: 'Intelligent repricing with competitor analysis and Buy Box strategies.',
    icon: BoltIcon,
    href: '/repricing',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    name: 'AI Analytics',
    description: 'Machine learning insights with trend prediction and sentiment analysis.',
    icon: CpuChipIcon,
    href: '/ai',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
  },
  {
    name: 'Dashboard',
    description: 'Comprehensive control panel with real-time metrics and performance tracking.',
    icon: PresentationChartBarIcon,
    href: '/dashboard',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
  },
]

const stats = [
  { name: 'Products Analyzed', value: '12,345' },
  { name: 'Profit Generated', value: '$89,654' },
  { name: 'Accuracy Rate', value: '94.2%' },
  { name: 'Active Users', value: '2,847' },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <CpuChipIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Amazon Dropshipping</h1>
                <p className="text-sm text-gray-500">AI-Powered Arbitrage Platform</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Login
              </Link>
              <Link 
                href="/auth/register" 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                AI-Powered Amazon
                <span className="block gradient-text">Dropshipping Platform</span>
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Revolutionize your e-commerce business with advanced machine learning, 
                real-time analytics, and automated arbitrage strategies that maximize profit 
                while minimizing risk.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/dashboard" 
                className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 transition-all transform hover:scale-105 shadow-lg"
              >
                Launch Dashboard
              </Link>
              <Link 
                href="/demo" 
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg text-lg font-medium hover:border-gray-400 hover:bg-gray-50 transition-all"
              >
                View Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.name} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-blue-600">{stat.value}</div>
                <div className="text-sm md:text-base text-gray-600 mt-2">{stat.name}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Maximum Profit
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our comprehensive suite of AI-powered tools helps you identify opportunities, 
              optimize operations, and scale your Amazon business efficiently.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Link key={feature.name} href={feature.href}>
                  <div className="bg-white rounded-xl p-8 shadow-sm hover:shadow-md transition-all duration-300 card-hover border border-gray-100">
                    <div className="flex items-center mb-4">
                      <div className={`p-3 rounded-lg ${feature.bgColor}`}>
                        <Icon className={`w-6 h-6 ${feature.color}`} />
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">
                      {feature.name}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                    <div className="mt-4 flex items-center text-blue-600 font-medium">
                      Learn more 
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-700">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Join thousands of successful sellers who have automated their Amazon 
            dropshipping operations with our AI-powered platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/auth/register" 
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-50 transition-all transform hover:scale-105 shadow-lg"
            >
              Start Free Trial
            </Link>
            <Link 
              href="/contact" 
              className="border-2 border-white text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-white hover:text-blue-600 transition-all"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <CpuChipIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold">Amazon Dropshipping</span>
              </div>
              <p className="text-gray-400 mb-4 max-w-md">
                Advanced AI-powered platform for Amazon dropshipping arbitrage with 
                real-time analytics and automated optimization.
              </p>
              <div className="text-sm text-gray-500">
                © 2024 Amazon Dropshipping Solutions. All rights reserved.
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Platform</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/features" className="hover:text-white transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/api" className="hover:text-white transition-colors">API</Link></li>
                <li><Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
                <li><Link href="/help" className="hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="/status" className="hover:text-white transition-colors">Status</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}