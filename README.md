# Automated AI Video Director & Editor

A modular, AI-driven platform that transforms raw video into professional, ready-to-publish edits with minimal manual intervention. This system functions as an intelligent AI Director that combines automated creative decisions with a flexible node-based preset system.

## 🚀 Features

- **Node-Based Preset System**: Create, save, and reuse editing workflows by connecting modular processing nodes
- **AI Director**: Intelligent automation for creative decision-making and timeline generation
- **Multi-Language Support**: Dual-language transcription (English + Urdu) with speaker diarization
- **Timeline Preview**: Interactive timeline with proxy video and synchronized transcripts
- **Multi-Format Export**: Support for various video formats, aspect ratios, and professional editing software
- **Professional Integration**: Export to Premiere Pro and DaVinci Resolve project files
- **Comprehensive Testing**: 85%+ backend coverage, 70%+ frontend coverage with visual regression testing

## 🏗️ Architecture

The system follows a modular architecture with:

- **Processing Nodes**: STT, Shot Detection, AI Director, Assembly, Export
- **Contract System**: JSON Schema validation for all node inputs/outputs
- **Replay System**: Deterministic job reproduction with full manifest tracking
- **Quality Gates**: Comprehensive testing pyramid (unit, integration, E2E, visual)
- **CI/CD Pipeline**: Automated testing and deployment with GitHub Actions

## 📋 Requirements

### System Requirements
- Python 3.9+
- FFmpeg
- Git
- Node.js (for frontend components)

### Development Setup
1. Clone the repository
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   ```
3. Set up pre-commit hooks:
   ```bash
   pre-commit install
   ```
4. Run tests:
   ```bash
   pytest
   ```

## 🧪 Testing

The project implements a comprehensive testing strategy:

- **Unit Tests (60%)**: Individual functions and methods
- **Integration Tests (25%)**: Node-to-node interactions
- **E2E Tests (10%)**: Complete workflows from upload to export
- **Visual Regression Tests (5%)**: UI consistency validation

### Running Tests
```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Run specific test types
pytest tests/unit/          # Unit tests
pytest tests/integration/  # Integration tests
pytest tests/e2e/          # End-to-end tests
pytest tests/visual/       # Visual regression tests
```

## 🔧 Development

### Project Structure
```
├── src/
│   ├── core/              # Core business logic
│   │   ├── nodes/         # Processing nodes
│   │   ├── contracts/     # JSON Schema definitions
│   │   └── replay/        # Replay manifest system
│   ├── ui/                # Frontend components
│   ├── infrastructure/    # External services
│   └── api/               # REST API endpoints
├── tests/                 # Test suites
├── docs/                  # Documentation
├── tasks/                 # PRDs and task lists
└── .github/               # CI/CD workflows
```

### Code Quality
- **Pre-commit hooks**: Automated code formatting and linting
- **Type checking**: mypy for static type analysis
- **Security scanning**: bandit and safety for vulnerability detection
- **Code coverage**: 85%+ backend, 70%+ frontend requirement

### Adding New Features
1. Create PRD following the established template
2. Generate task list with TDD-first approach
3. Implement with comprehensive testing
4. Follow engineering standards and quality gates

## 🚀 Deployment

### Development
```bash
# Run locally
uvicorn src.api.main:app --reload

# Run with Docker
docker build -t ai-video-editor .
docker run -p 8000:8000 ai-video-editor
```

### Production
The system supports multiple deployment strategies:
- **Containerized**: Docker with multi-stage builds
- **Orchestrated**: Kubernetes-ready architecture
- **Serverless**: Modular design for cloud functions
- **CI/CD**: Automated deployment via GitHub Actions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow the TDD-first approach
4. Ensure all tests pass
5. Submit a pull request

### Contribution Guidelines
- Write tests before implementing features
- Follow the established code style
- Update documentation as needed
- Ensure CI/CD pipeline passes
- Add appropriate logging and monitoring

## 📊 Monitoring & Observability

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Metrics Collection**: Performance and business metrics
- **Distributed Tracing**: OpenTelemetry integration
- **Error Tracking**: Comprehensive error reporting and alerting
- **Health Checks**: Endpoint monitoring and alerting

## 🔒 Security

- **Input Validation**: JSON Schema validation for all inputs
- **Authentication**: JWT-based authentication system
- **Authorization**: Role-based access control
- **Data Protection**: Encryption at rest and in transit
- **Privacy Compliance**: GDPR and local regulation compliance

## 📈 Performance

- **Proxy-First**: Efficient video preview with proxy generation
- **Async Processing**: Non-blocking I/O for better scalability
- **Caching Strategy**: Multi-level caching for improved performance
- **Resource Optimization**: Memory and CPU optimization for video processing

## 🐛 Troubleshooting

### Common Issues
- **Video Processing Fails**: Check FFmpeg installation and video format support
- **AI Service Errors**: Verify API keys and rate limits
- **Memory Issues**: Monitor memory usage for large video files
- **Network Timeouts**: Check connectivity to external AI services

### Debug Mode
Enable debug logging for detailed troubleshooting:
```bash
export LOG_LEVEL=DEBUG
python -m src.api.main
```

## 📚 Documentation

- [Engineering Standards](docs/ENGINEERING-STANDARDS.md)
- [Node Contracts](docs/NODE-CONTRACTS.md)
- [Testing Strategy](docs/TESTING-STRATEGY.md)
- [CI/CD Pipeline](docs/CICD-PIPELINE.md)
- [Implementation Checklist](docs/IMPLEMENTATION-CHECKLIST.md)
- [Workflow Flowchart](docs/WORKFLOW-FLOWCHART.md)

## 🏗️ Roadmap

### Phase 1 (MVP) ✅
- [x] Node graph editor
- [x] Proxy timeline with transcripts
- [x] Rule-based Director
- [x] FFmpeg assembly + EDL export
- [x] Save/load presets

### Phase 2 (Current)
- [ ] Nested graphs for complex workflows
- [ ] Executive Director chat interface
- [ ] Preset marketplace
- [ ] Professional editing software exports

### Phase 3 (Future)
- [ ] ML-trained Director
- [ ] Dubbing and TTS
- [ ] Avatar integration
- [ ] Social media publishing
- [ ] Premium GPU features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **AI Services**: AssemblyAI, Qwen Vision, Gemini Pro
- **Video Processing**: FFmpeg
- **Community**: Open source contributors and testers

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting guide
- Review the documentation

---

**Built with ❤️ for the future of AI-powered video editing**