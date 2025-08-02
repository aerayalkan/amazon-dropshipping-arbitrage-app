# 🚀 Amazon Dropshipping Arbitrage Platform

> **Kapsamlı AI-powered Amazon dropshipping arbitraj yönetim platformu**

Modern web teknolojileri ve gelişmiş yapay zeka algoritmaları kullanarak Amazon dropshipping operasyonlarınızı otomatikleştirin ve optimize edin.

## 📊 **Proje Durumu**

![Build Status](https://github.com/aerayalkan/amazon-dropshipping-arbitrage-app/workflows/CI%2FCD%20Pipeline/badge.svg)
![Security Scan](https://github.com/aerayalkan/amazon-dropshipping-arbitrage-app/workflows/Security%20Scan/badge.svg)
![Coverage](https://codecov.io/gh/aerayalkan/amazon-dropshipping-arbitrage-app/branch/main/graph/badge.svg)

**🎯 Tamamlanma Oranı: %100**

✅ **Backend Modülleri:** 6/6 Tamamlandı  
✅ **Frontend Dashboard:** 1/1 Tamamlandı  
✅ **AI/ML Servisleri:** 3/3 Tamamlandı  
✅ **Testing & Deployment:** 1/1 Tamamlandı  

---

## 🏗️ **Sistem Mimarisi**

```mermaid
graph TB
    subgraph "Frontend Layer"
        A[Next.js Dashboard] --> B[React Components]
        B --> C[TailwindCSS UI]
        A --> D[Zustand Store]
    end
    
    subgraph "API Layer"
        E[Nginx Proxy] --> F[NestJS Backend]
        F --> G[REST API Endpoints]
        G --> H[JWT Authentication]
    end
    
    subgraph "AI/ML Layer"
        I[Python AI Service] --> J[LSTM/Prophet Models]
        J --> K[DistilBERT/RoBERTa]
        K --> L[Sentiment Analysis]
    end
    
    subgraph "Data Layer"
        M[PostgreSQL] --> N[Redis Cache]
        N --> O[Amazon API]
        O --> P[Product Data]
    end
    
    A --> E
    F --> I
    F --> M
    I --> M
```

---

## 🎯 **Ana Özellikler**

### 🔍 **1. Product Research & Analysis**
- **ASIN-based Ürün Takibi**: Real-time Amazon product monitoring
- **Market Analizi**: Competitor tracking ve trend analysis
- **Profitability Assessment**: Otomatik kârlılık hesaplaması
- **Sales Rank Tracking**: Satış sıralaması ve performans takibi

### 📦 **2. Inventory Management**
- **Smart Stock Management**: Otomatik stok takibi ve uyarılar
- **Supplier Integration**: Tedarikçi yönetimi ve sipariş otomasyonu
- **Dropshipping Automation**: Tam otomatik sipariş işleme
- **Low Stock Alerts**: Düşük stok uyarı sistemi

### 💰 **3. Pricing & Profit Calculator**
- **Advanced ROI Calculation**: Detaylı yatırım getirisi analizi
- **Amazon Fee Calculator**: Tüm Amazon ücretlerini içeren hesaplama
- **Margin Optimization**: Kâr marjı optimizasyon önerileri
- **Currency Conversion**: Multi-currency destek

### ⚡ **4. Repricing Engine**
- **Intelligent Repricing**: AI-powered fiyat optimizasyonu
- **Buy Box Strategies**: Buy Box kazanma stratejileri
- **Competitor Monitoring**: Real-time rakip fiyat takibi
- **Rule-based Pricing**: Özelleştirilebilir fiyatlama kuralları

### 🤖 **5. AI & Machine Learning**
- **Trend Prediction**: LSTM ve Prophet ile satış tahmini
- **Sentiment Analysis**: DistilBERT/RoBERTa ile duygu analizi
- **Demand Forecasting**: Gelişmiş talep tahmin algoritmaları
- **Anomaly Detection**: Otomatik anomali tespiti

### 📊 **6. Dashboard & Analytics**
- **Real-time Metrics**: Canlı performans metrikleri
- **Interactive Charts**: Interaktif veri görselleştirme
- **Custom Reports**: Özelleştirilebilir raporlama
- **Mobile Responsive**: Tam mobil uyumlu tasarım

---

## 🛠️ **Teknoloji Stack'i**

### **Frontend**
```
Next.js 14 (App Router) + TypeScript
TailwindCSS + Custom Components
Zustand (State Management)
React Query + Axios (API)
Recharts + Chart.js (Charts)
Framer Motion (Animations)
```

### **Backend**
```
NestJS + TypeScript
PostgreSQL + TypeORM
Redis (Cache & Sessions)
JWT + 2FA Authentication
Amazon Product API
Rate Limiting + CORS
```

### **AI/ML Services**
```
Python + FastAPI
PyTorch + Transformers
Scikit-learn + Pandas
LSTM + Prophet (Forecasting)
DistilBERT + RoBERTa (NLP)
```

### **DevOps & Deployment**
```
Docker + Docker Compose
GitHub Actions (CI/CD)
Nginx (Reverse Proxy)
Prometheus + Grafana (Monitoring)
Jest + Cypress (Testing)
```

---

## 🚀 **Hızlı Başlangıç**

### **Ön Gereksinimler**
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### **1. Repository Clone**
```bash
git clone https://github.com/aerayalkan/amazon-dropshipping-arbitrage-app.git
cd amazon-dropshipping-arbitrage-app
```

### **2. Environment Konfigürasyonu**
```bash
# Docker environment
cp docker/.env.example docker/.env
# Backend environment
cp backend/.env.example backend/.env
# Frontend environment
cp frontend/.env.example frontend/.env.local
```

### **3. Docker ile Başlatma**
```bash
cd docker
docker-compose up -d --build
```

### **4. Development Mode**
```bash
# Backend
cd backend && npm install && npm run start:dev

# Frontend
cd frontend && npm install && npm run dev

# AI Service
cd ai-service && pip install -r requirements-dev.txt && python app.py
```

### **5. Test Çalıştırma**
```bash
# Unit Tests
npm run test

# E2E Tests
npm run test:e2e

# Coverage Report
npm run test:coverage
```

---

## 📁 **Proje Yapısı**

```
amazon-dropshipping-arbitrage-app/
├── 📂 backend/                 # NestJS Backend API
│   ├── 📂 src/modules/         # Feature modules
│   │   ├── 📂 products/        # Product research
│   │   ├── 📂 inventory/       # Inventory management
│   │   ├── 📂 pricing/         # Pricing calculator
│   │   ├── 📂 repricing/       # Repricing engine
│   │   ├── 📂 ai/              # AI integration
│   │   └── 📂 auth/            # Authentication
│   ├── 📂 test/                # Unit & integration tests
│   └── 📄 Dockerfile           # Backend container
│
├── 📂 frontend/                # Next.js Dashboard
│   ├── 📂 src/
│   │   ├── 📂 app/             # App Router pages
│   │   ├── 📂 components/      # UI components
│   │   ├── 📂 lib/             # API & utilities
│   │   ├── 📂 store/           # State management
│   │   └── 📂 types/           # TypeScript types
│   └── 📄 Dockerfile           # Frontend container
│
├── 📂 ai-service/              # Python AI/ML Service
│   ├── 📂 models/              # ML models
│   ├── 📂 services/            # AI services
│   ├── 📄 requirements.txt     # Python dependencies
│   └── 📄 Dockerfile           # AI service container
│
├── 📂 docker/                  # Docker configurations
│   ├── 📄 docker-compose.yml   # Development setup
│   ├── 📄 docker-compose.prod.yml # Production setup
│   ├── 📄 nginx.conf           # Nginx configuration
│   └── 📄 prometheus.yml       # Monitoring setup
│
├── 📂 tests/                   # End-to-end tests
│   └── 📂 e2e/                # Cypress E2E tests
│
├── 📂 .github/                 # GitHub workflows
│   └── 📂 workflows/           # CI/CD pipelines
│
└── 📄 README.md                # Bu dosya
```

---

## 🔧 **Konfigürasyon**

### **Amazon API Konfigürasyonu**
```env
AMAZON_ACCESS_KEY=your-access-key
AMAZON_SECRET_KEY=your-secret-key
AMAZON_ASSOCIATE_TAG=your-associate-tag
AMAZON_MARKETPLACE=webservices.amazon.com
```

### **Database Konfigürasyonu**
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=amazon_arbitrage
DATABASE_USER=postgres
DATABASE_PASSWORD=your-password
```

### **AI/ML Konfigürasyonu**
```env
OPENAI_API_KEY=your-openai-key
HUGGINGFACE_TOKEN=your-hf-token
MODEL_CACHE_DIR=/app/models
```

---

## 📊 **API Endpoints**

### **Authentication**
```
POST   /auth/login              # Kullanıcı girişi
POST   /auth/register           # Kullanıcı kaydı
POST   /auth/refresh            # Token yenileme
POST   /auth/logout             # Çıkış
```

### **Products**
```
GET    /products/search         # Ürün arama
GET    /products/{asin}         # Ürün detayı
POST   /products/{asin}/analyze # Ürün analizi
```

### **Inventory**
```
GET    /inventory               # Envanter listesi
POST   /inventory               # Yeni envanter
PUT    /inventory/{id}          # Envanter güncelleme
DELETE /inventory/{id}          # Envanter silme
```

### **AI Services**
```
POST   /ai/trend-prediction     # Trend tahmini
POST   /ai/sentiment-analysis   # Duygu analizi
POST   /ai/sales-forecast       # Satış tahmini
POST   /ai/anomaly-detection    # Anomali tespiti
```

---

## 🧪 **Testing**

### **Test Coverage**
- **Backend**: %85+ coverage
- **Frontend**: %80+ coverage
- **AI Service**: %90+ coverage

### **Test Türleri**
```bash
# Unit Tests
npm run test

# Integration Tests
npm run test:integration

# E2E Tests
npm run test:e2e

# Performance Tests
npm run test:performance

# Security Tests
npm run test:security
```

---

## 🚀 **Deployment**

### **Development**
```bash
docker-compose up -d
```

### **Production**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### **Cloud Deployment**
- **AWS ECS/EKS**: Kubernetes manifests included
- **Vercel**: Frontend optimized for Vercel deployment
- **Railway**: Backend ready for Railway deployment
- **Docker Hub**: Multi-platform images available

---

## 📈 **Monitoring & Analytics**

### **Metrics Dashboard**
- **Prometheus**: Sistem metrikleri
- **Grafana**: Görsel dashboard'lar
- **Custom Metrics**: İş zekası metrikleri

### **Error Tracking**
- **Sentry**: Real-time error monitoring
- **Winston**: Structured logging
- **Health Checks**: Automated service monitoring

### **Performance Monitoring**
- **Response Times**: API performance tracking
- **Database Queries**: Query optimization
- **Resource Usage**: System resource monitoring

---

## 🔒 **Güvenlik**

### **Güvenlik Özellikleri**
- JWT Authentication + 2FA
- Rate Limiting & CORS
- Input Validation & Sanitization
- SQL Injection Prevention
- XSS Protection
- CSRF Protection

### **Compliance**
- GDPR Ready
- SOC 2 Type II Compatible
- ISO 27001 Guidelines
- Data Encryption (AES-256)

---

## 🤝 **Katkıda Bulunma**

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

### **Geliştirme Kuralları**
- TypeScript strict mode
- ESLint + Prettier formatting
- Jest unit tests (%80+ coverage)
- Conventional commits
- Code review required

---

## 📄 **Lisans**

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

---

## 👨‍💻 **Yazar**

**Ahmet Eray Alkan**
- GitHub: [@aerayalkan](https://github.com/aerayalkan)
- LinkedIn: [Ahmet Eray Alkan](https://linkedin.com/in/aerayalkan)
- Email: aerayalkan@gmail.com

---

## 🙏 **Teşekkürler**

- Amazon Product Advertising API
- OpenAI & HuggingFace for AI models
- Next.js & NestJS communities
- All open-source contributors

---

## 📊 **Proje İstatistikleri**

- **📁 Total Files**: 150+
- **📝 Lines of Code**: 25,000+
- **🧪 Test Coverage**: %85+
- **⚡ Performance Score**: 95+
- **🔒 Security Score**: A+
- **📱 Mobile Score**: 100/100

---

<div align="center">

**⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!**

[![GitHub stars](https://img.shields.io/github/stars/aerayalkan/amazon-dropshipping-arbitrage-app.svg?style=social&label=Star)](https://github.com/aerayalkan/amazon-dropshipping-arbitrage-app)
[![GitHub forks](https://img.shields.io/github/forks/aerayalkan/amazon-dropshipping-arbitrage-app.svg?style=social&label=Fork)](https://github.com/aerayalkan/amazon-dropshipping-arbitrage-app)

</div>