.PHONY: help install dev backend frontend test test-backend test-frontend lint format clean docker-up deploy

# Default target
help:
	@echo "🚀 Automated AI Video Editor - Development Commands"
	@echo ""
	@echo "Installation & Setup:"
	@echo "  install       Install all dependencies (Python + Node.js)"
	@echo "  setup         Set up development environment"
	@echo ""
	@echo "Development:"
	@echo "  dev           Start both frontend and backend in development mode"
	@echo "  backend       Start FastAPI backend only"
	@echo "  frontend      Start React frontend only"
	@echo "  test          Run all tests (Python + React)"
	@echo "  test-backend  Run Python tests only"
	@echo "  test-frontend Run React tests only"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint          Run linting on all code"
	@echo "  format        Format all code"
	@echo "  type-check    Run TypeScript type checking"
	@echo ""
	@echo "Production:"
	@echo "  build         Build frontend for production"
	@echo "  docker-up     Start with Docker Compose"
	@echo "  deploy        Deploy to production"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean         Clean build artifacts and caches"
	@echo "  logs          Show application logs"
	@echo "  health        Check health of all services"

# Install all dependencies
install:
	@echo "📦 Installing Python dependencies..."
	python -m pip install --upgrade pip
	pip install -r requirements.txt
	pip install -r requirements-dev.txt

	@echo "📦 Installing Node.js dependencies..."
	npm install

	@echo "✅ Installation complete!"

# Set up development environment
setup: install
	@echo "🔧 Setting up development environment..."
	python -c "import nltk; nltk.download('punkt')" 2>/dev/null || echo "NLTK data downloaded"
	@echo "✅ Setup complete!"

# Start both frontend and backend
dev:
	@echo "🚀 Starting development environment..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo ""
	@echo "Press Ctrl+C to stop all services"
	@echo ""

	# Start backend in background
	python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload &
	BACKEND_PID=$$!

	# Start frontend
	npm run dev &
	FRONTEND_PID=$$!

	# Wait for both processes
	wait $$BACKEND_PID $$FRONTEND_PID

# Start backend only
backend:
	@echo "🐍 Starting FastAPI backend..."
	@echo "API Docs: http://localhost:8000/docs"
	@echo "Health: http://localhost:8000/health"
	python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload

# Start frontend only
frontend:
	@echo "⚛️ Starting React frontend..."
	@echo "App: http://localhost:3000"
	npm run dev

# Run all tests
test: test-backend test-frontend
	@echo "✅ All tests completed!"

# Run Python tests
test-backend:
	@echo "🧪 Running Python tests..."
	pytest --cov=src --cov-report=html --cov-report=term-missing tests/

# Run React tests
test-frontend:
	@echo "🧪 Running React tests..."
	npm test -- --coverage --watchAll=false

# Run linting
lint:
	@echo "🔍 Running linting..."
	# Python linting
	flake8 src/ tests/ --count --select=E9,F63,F7,F82 --show-source --statistics
	black --check src/ tests/
	isort --check-only src/ tests/

	# React linting
	npm run lint

# Format code
format:
	@echo "🎨 Formatting code..."
	# Python formatting
	black src/ tests/
	isort src/ tests/

	# React formatting
	npm run format

# Type checking
type-check:
	@echo "🔍 Running TypeScript type checking..."
	npx tsc --noEmit

# Build for production
build:
	@echo "🏗️ Building for production..."
	npm run build

# Docker commands
docker-up:
	@echo "🐳 Starting with Docker Compose..."
	docker-compose up --build

docker-down:
	@echo "🐳 Stopping Docker containers..."
	docker-compose down

# Deploy to production
deploy:
	@echo "🚀 Deploying to production..."
	@echo "This would deploy to your configured production environment"
	# Add your deployment commands here

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	# Python cleanup
	find . -type d -name __pycache__ -delete
	find . -type f -name "*.pyc" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .pytest_cache/
	rm -rf .coverage
	rm -rf htmlcov/

	# Node.js cleanup
	rm -rf node_modules/.cache
	rm -rf dist/
	rm -rf build/

	# Logs cleanup
	rm -f logs/*.log

	@echo "✅ Cleanup complete!"

# Show logs
logs:
	@echo "📋 Showing application logs..."
	tail -f logs/app.log 2>/dev/null || echo "No log file found. Start the backend first."

# Health check
health:
	@echo "🏥 Checking service health..."
	@echo ""
	@echo "Backend Health:"
	@curl -s http://localhost:8000/health | python -m json.tool || echo "❌ Backend not responding"

	@echo ""
	@echo "Frontend Health:"
	@curl -s -I http://localhost:3000 | head -1 || echo "❌ Frontend not responding"

	@echo ""
	@echo "Service Status:"
	@ps aux | grep -E "(uvicorn|node)" | grep -v grep || echo "❌ No services running"

# Development with file watching
watch:
	@echo "👀 Starting with file watching..."
	make dev

# Quick test (fast feedback)
quick-test:
	@echo "⚡ Running quick tests..."
	pytest tests/unit/test_config.py -v
	npm run test -- --testPathPattern=NodeEditor --watchAll=false

# Security scan
security:
	@echo "🔒 Running security checks..."
	# Python security
	bandit -r src/ -f json -o security-report.json || echo "Bandit not installed"

	# Node.js security
	npm audit --audit-level=moderate

# Performance test
performance:
	@echo "⚡ Running performance tests..."
	pytest tests/performance/ -v

# Integration test
integration:
	@echo "🔗 Running integration tests..."
	pytest tests/integration/ -v

# End-to-end test
e2e:
	@echo "🎭 Running end-to-end tests..."
	pytest tests/e2e/ -v --tb=short

# Database operations (if using database)
db-up:
	@echo "🗄️ Starting database..."
	# Add database startup commands

db-migrate:
	@echo "🗄️ Running database migrations..."
	# Add migration commands

db-seed:
	@echo "🗄️ Seeding database..."
	# Add seed commands

# API documentation
docs:
	@echo "📚 Generating API documentation..."
	@echo "Swagger UI: http://localhost:8000/docs"
	@echo "ReDoc: http://localhost:8000/redoc"
	# Add documentation generation commands

# Backup
backup:
	@echo "💾 Creating backup..."
	# Add backup commands

# Restore
restore:
	@echo "🔄 Restoring from backup..."
	# Add restore commands

# Environment info
info:
	@echo "ℹ️ Environment Information:"
	@echo "Python version: $$(python --version)"
	@echo "Node.js version: $$(node --version)"
	@echo "NPM version: $$(npm --version)"
	@echo "Platform: $$(uname -a)"
	@echo "Current directory: $$(pwd)"

# Update dependencies
update:
	@echo "⬆️ Updating dependencies..."
	# Python
	pip install --upgrade pip
	pip install -r requirements.txt --upgrade
	pip install -r requirements-dev.txt --upgrade

	# Node.js
	npm update

	@echo "✅ Dependencies updated!"

# Check for vulnerabilities
audit:
	@echo "🔍 Checking for vulnerabilities..."
	# Python
	safety check

	# Node.js
	npm audit

# Create release
release:
	@echo "🏷️ Creating release..."
	@echo "Current version: $$(git describe --tags --abbrev=0 2>/dev/null || echo 'v0.0.0')"
	# Add release commands

# Development workflow
workflow:
	@echo "🔄 Running development workflow..."
	make clean
	make install
	make test
	make build
	@echo "✅ Development workflow complete!"

# CI/CD pipeline (local simulation)
ci:
	@echo "🔄 Running CI/CD pipeline..."
	make install
	make lint
	make test
	make build
	make security
	@echo "✅ CI/CD pipeline complete!"

# Full development cycle
dev-cycle: clean install test dev

# Quick development restart
restart:
	@echo "🔄 Quick restart..."
	make clean
	make dev

# Debug mode
debug:
	@echo "🐛 Starting in debug mode..."
	DEBUG=true python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug &
	DEBUG=true npm run dev

# Profile performance
profile:
	@echo "📊 Profiling performance..."
	python -m cProfile -s time src/api/main.py || echo "Profiling backend..."
	npx react-devtools || echo "Install React DevTools for frontend profiling"

# Memory usage
memory:
	@echo "🧠 Checking memory usage..."
	ps aux | grep -E "(python|node)" | grep -v grep || echo "No processes running"

# Network connections
netstat:
	@echo "🌐 Checking network connections..."
	netstat -tlnp 2>/dev/null | grep -E "(8000|3000)" || echo "No services on expected ports"

# Environment variables
env:
	@echo "🔐 Checking environment variables..."
	@echo "Required API keys:"
	@echo "ASSEMBLYAI_API_KEY: $$(test -n "$$ASSEMBLYAI_API_KEY" && echo '✅ Set' || echo '❌ Missing')"
	@echo "QWEN_API_KEY: $$(test -n "$$QWEN_API_KEY" && echo '✅ Set' || echo '❌ Missing')"
	@echo "GEMINI_API_KEY: $$(test -n "$$GEMINI_API_KEY" && echo '✅ Set' || echo '❌ Missing')"

# Validate setup
validate:
	@echo "✅ Validating setup..."
	@command -v python >/dev/null 2>&1 || (echo "❌ Python not found" && exit 1)
	@command -v node >/dev/null 2>&1 || (echo "❌ Node.js not found" && exit 1)
	@command -v npm >/dev/null 2>&1 || (echo "❌ npm not found" && exit 1)
	@test -f requirements.txt || (echo "❌ requirements.txt not found" && exit 1)
	@test -f package.json || (echo "❌ package.json not found" && exit 1)
	@echo "✅ All validations passed!"

# Interactive shell
shell:
	@echo "🐚 Starting interactive shell..."
	bash

# Help for specific commands
help-%:
	@echo "Help for command: $*"
	@grep -A 2 "^$*:.*#" Makefile | grep -v "^--"

# Default to help if no target specified
.DEFAULT_GOAL := help