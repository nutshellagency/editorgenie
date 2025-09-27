# 🚀 Automated AI Video Editor - Deployment Guide

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.8+ and pip
- **Git** for version control
- **API Keys** for AI services (AssemblyAI, Qwen Vision, Gemini Pro)

## 🛠️ Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd automated-ai-video-editor
```

### 2. Backend Setup (Python/FastAPI)

```bash
# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys:
# ASSEMBLYAI_API_KEY=your_assemblyai_key
# QWEN_API_KEY=your_qwen_key
# GEMINI_API_KEY=your_gemini_key
```

### 3. Frontend Setup (React/TypeScript)

```bash
# Install Node.js dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API configuration
```

## 🎯 Running the Application

### Development Mode (Both Frontend & Backend)

#### Option 1: Run Separately

**Terminal 1 - Backend:**
```bash
# Activate virtual environment
source venv/bin/activate  # Windows: venv\Scripts\activate

# Start FastAPI backend
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
# Start React development server
npm run dev
```

#### Option 2: Run with Make (Recommended)

```bash
# Start both frontend and backend
make dev

# Or run individually
make backend    # Start only backend
make frontend   # Start only frontend
```

### Production Mode

#### Backend Production
```bash
# Activate virtual environment
source venv/bin/activate

# Production server with multiple workers
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Frontend Production
```bash
# Build for production
npm run build

# Serve built files
npm run preview
```

## 🧪 Testing

### Run All Tests

```bash
# Backend tests (Python)
make test-backend
# or: pytest

# Frontend tests (React)
make test-frontend
# or: npm test

# All tests
make test
```

### Test Categories

```bash
# Unit tests only
pytest tests/unit/

# Integration tests
pytest tests/integration/

# End-to-end tests
pytest tests/e2e/

# Performance tests
pytest tests/performance/

# Visual regression tests
pytest tests/visual/
```

### Manual Testing Checklist

- [ ] Upload video file through frontend
- [ ] Verify transcription appears
- [ ] Check scene detection visualization
- [ ] Test AI director suggestions
- [ ] Verify video export functionality
- [ ] Test error handling with invalid files
- [ ] Verify responsive design on mobile

## 🔧 Configuration

### Environment Variables

Create `.env.local` with:

```bash
# API Keys
ASSEMBLYAI_API_KEY=your_assemblyai_api_key
QWEN_API_KEY=your_qwen_vision_api_key
GEMINI_API_KEY=your_gemini_pro_api_key

# Application Settings
DEBUG=true
LOG_LEVEL=INFO
MAX_FILE_SIZE=100MB
ALLOWED_VIDEO_FORMATS=mp4,mov,avi,mkv,webm

# Frontend Settings
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000

# Database (if using)
DATABASE_URL=sqlite:///./video_editor.db
```

### Application Configuration

Edit `src/config.py` for backend settings:

```python
class Settings(BaseSettings):
    # API Settings
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_reload: bool = True

    # File Upload Settings
    max_upload_size: int = 100 * 1024 * 1024  # 100MB
    upload_dir: str = "uploads"

    # AI Service Settings
    ai_timeout: int = 30
    ai_retry_attempts: int = 3
    ai_rate_limit_per_minute: int = 60
```

## 📊 Monitoring & Health Checks

### Health Endpoints

- **Backend Health:** `http://localhost:8000/health`
- **Frontend Health:** `http://localhost:3000/health`

### Logs

```bash
# View backend logs
tail -f logs/app.log

# View frontend console
# Open browser dev tools on http://localhost:3000
```

### Metrics Dashboard

Access monitoring dashboard at:
- **API Metrics:** `http://localhost:8000/docs` (Swagger UI)
- **Performance Metrics:** `http://localhost:8000/metrics`

## 🚀 Deployment

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build individually
docker build -t ai-video-editor-backend -f Dockerfile.backend .
docker build -t ai-video-editor-frontend -f Dockerfile.frontend .
```

### Cloud Deployment (AWS/Heroku/Vercel)

#### Backend (Heroku/Railway)
```bash
# Deploy to Heroku
heroku create ai-video-editor-backend
heroku config:set ASSEMBLYAI_API_KEY=your_key
git push heroku main
```

#### Frontend (Vercel/Netlify)
```bash
# Deploy to Vercel
vercel --prod
# or Netlify
netlify deploy --prod --dir=dist
```

## 🔍 Troubleshooting

### Common Issues

**Backend won't start:**
```bash
# Check Python version
python --version  # Should be 3.8+

# Check dependencies
pip list | grep fastapi

# Check API keys in .env.local
```

**Frontend build fails:**
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Check Node version
node --version  # Should be 18+
```

**AI services not working:**
```bash
# Verify API keys are set
echo $ASSEMBLYAI_API_KEY

# Test API connectivity
curl -H "authorization: $ASSEMBLYAI_API_KEY" https://api.assemblyai.com/v2/health
```

### Debug Mode

```bash
# Backend debug
DEBUG=true python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug

# Frontend debug
DEBUG=true npm run dev
```

## 📚 API Documentation

### Backend API

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`
- **OpenAPI JSON:** `http://localhost:8000/openapi.json`

### Key Endpoints

```bash
# Upload video
POST /api/v1/videos/upload

# Get transcription
GET /api/v1/videos/{video_id}/transcription

# Get scenes
GET /api/v1/videos/{video_id}/scenes

# Export video
POST /api/v1/videos/{video_id}/export

# Health check
GET /health
```

## 🎛️ Development Scripts

### Makefile Commands

```bash
make help          # Show all commands
make install       # Install all dependencies
make dev          # Start development servers
make test         # Run all tests
make lint         # Run linting
make format       # Format code
make clean        # Clean build artifacts
make docker-up    # Start with Docker
make deploy       # Deploy to production
```

### NPM Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
npm run test      # Run tests
npm run lint      # Lint code
npm run format    # Format code
npm run analyze   # Bundle analyzer
```

## 🔐 Security

### API Key Management

- Store API keys in environment variables
- Never commit keys to version control
- Use different keys for development/production
- Rotate keys regularly

### File Upload Security

- Validate file types and sizes
- Scan uploaded files for malware
- Store files securely with access controls
- Implement rate limiting on uploads

## 📈 Performance Optimization

### Backend Optimization

```python
# Enable connection pooling
DATABASE_CONNECTION_POOL_SIZE=10

# Enable caching
REDIS_URL=redis://localhost:6379

# Optimize AI service calls
AI_BATCH_SIZE=5
AI_CACHE_TTL=3600
```

### Frontend Optimization

```bash
# Enable code splitting
npm run build -- --analyze

# Optimize images
npm install --save-dev image-webpack-loader

# Enable service worker
npm install --save-dev workbox-webpack-plugin
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the full test suite
6. Submit a pull request

## 📞 Support

For issues and questions:
- Check the troubleshooting guide above
- Review the API documentation
- Check existing issues on GitHub
- Create a new issue with detailed information

---

**Happy coding! 🎉**