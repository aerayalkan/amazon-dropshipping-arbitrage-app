# Amazon Dropshipping Arbitrage Dashboard

Modern, AI-powered dashboard for Amazon dropshipping arbitrage operations. Built with Next.js 14, React 18, TypeScript, and TailwindCSS.

## 🚀 Features

- **AI-Powered Analytics**: Advanced machine learning for trend prediction and sentiment analysis
- **Real-time Data**: Live product tracking and price monitoring
- **Automated Repricing**: Intelligent repricing engine with competitor analysis
- **Inventory Management**: Comprehensive inventory tracking and alerts
- **Profit Calculator**: Advanced ROI and profit margin calculations
- **Modern UI**: Responsive design with dark mode support
- **Performance Optimized**: Built for speed and scalability

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS + Custom Components
- **State Management**: Zustand
- **Data Fetching**: React Query + Axios
- **Charts**: Recharts + Chart.js
- **Icons**: Heroicons + Lucide React
- **Animations**: Framer Motion
- **Forms**: React Hook Form
- **Notifications**: React Hot Toast

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/aerayalkan/amazon-dropshipping-arbitrage-app.git

# Navigate to frontend directory
cd amazon-dropshipping-arbitrage-app/frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

## 🚀 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler

# Analysis
npm run analyze      # Analyze bundle size
```

## 📁 Project Structure

```
src/
├── app/              # Next.js App Router pages
├── components/       # Reusable UI components
├── hooks/           # Custom React hooks
├── lib/             # Utility libraries (API, etc.)
├── store/           # Zustand stores
├── styles/          # Global styles and Tailwind config
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

## 🎯 Key Components

### Authentication
- JWT-based authentication with refresh tokens
- Two-factor authentication support
- Role-based access control

### Dashboard
- Real-time metrics and KPIs
- Interactive charts and graphs
- Customizable widgets

### Product Management
- ASIN-based product tracking
- Real-time price monitoring
- Competitor analysis

### AI Features
- LSTM and Prophet models for forecasting
- DistilBERT and RoBERTa for sentiment analysis
- Automated anomaly detection

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file with the following variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Amazon Dropshipping Dashboard
# ... (see .env.example for full list)
```

### API Integration

The frontend connects to the backend API running on port 3001. Make sure the backend is running before starting the frontend.

## 🎨 Theming

The application supports both light and dark themes with automatic system preference detection.

### Custom Colors
- Primary: Blue (#3b82f6)
- Secondary: Gray (#64748b)  
- Success: Green (#22c55e)
- Warning: Yellow (#f59e0b)
- Error: Red (#ef4444)

## 📱 Responsive Design

Fully responsive design supporting:
- Desktop (1024px+)
- Tablet (768px - 1023px)
- Mobile (320px - 767px)

## 🔒 Security Features

- CSRF protection
- XSS prevention
- Content Security Policy headers
- Secure authentication flows
- Input validation and sanitization

## 📊 Performance

- Code splitting and lazy loading
- Image optimization
- Bundle size optimization
- Caching strategies
- SEO optimization

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📈 Analytics

Integrated analytics support for:
- Google Analytics
- Mixpanel
- Custom event tracking

## 🚀 Deployment

### Vercel (Recommended)

```bash
# Deploy to Vercel
vercel --prod
```

### Docker

```bash
# Build Docker image
docker build -t amazon-dashboard-frontend .

# Run container
docker run -p 3000:3000 amazon-dashboard-frontend
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👨‍💻 Author

**Ahmet Eray Alkan**
- GitHub: [@aerayalkan](https://github.com/aerayalkan)
- Email: [your-email@example.com]

## 🙏 Acknowledgments

- Amazon Product Advertising API
- OpenAI for AI/ML capabilities
- Next.js team for the amazing framework
- Tailwind CSS for the utility-first CSS framework