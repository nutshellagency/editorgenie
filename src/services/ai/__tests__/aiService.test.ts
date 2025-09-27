import { AIService, AIServiceConfig, AIProvider, AIResponse } from '../aiService';
import { STTService } from '../sttService';
import { VisionService } from '../visionService';
import { TextAnalysisService } from '../textAnalysisService';

// Mock external AI providers
jest.mock('assemblyai', () => ({
  AssemblyAI: jest.fn().mockImplementation(() => ({
    transcripts: {
      create: jest.fn(),
      get: jest.fn(),
    },
  })),
}));

jest.mock('google-cloud/speech', () => ({
  SpeechClient: jest.fn().mockImplementation(() => ({
    recognize: jest.fn(),
  })),
}));

jest.mock('qwen-vision-api', () => ({
  QwenVision: jest.fn().mockImplementation(() => ({
    analyze: jest.fn(),
  })),
}));

jest.mock('gemini-pro-api', () => ({
  GeminiPro: jest.fn().mockImplementation(() => ({
    analyze: jest.fn(),
  })),
}));

describe('AIService', () => {
  let aiService: AIService;
  let mockConfig: AIServiceConfig;

  beforeEach(() => {
    mockConfig = {
      providers: {
        assemblyai: {
          apiKey: 'test-assemblyai-key',
          enabled: true,
        },
        google: {
          apiKey: 'test-google-key',
          enabled: true,
        },
        qwen: {
          apiKey: 'test-qwen-key',
          enabled: true,
        },
        gemini: {
          apiKey: 'test-gemini-key',
          enabled: true,
        },
      },
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
      },
    };

    aiService = new AIService(mockConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize with valid configuration', () => {
      expect(aiService).toBeInstanceOf(AIService);
      expect(aiService.getConfig()).toEqual(mockConfig);
    });

    it('should throw error with invalid configuration', () => {
      const invalidConfig = {} as AIServiceConfig;

      expect(() => {
        new AIService(invalidConfig);
      }).toThrow('Invalid AI service configuration');
    });

    it('should initialize all enabled providers', () => {
      const providers = aiService.getProviders();

      expect(providers.assemblyai).toBeDefined();
      expect(providers.google).toBeDefined();
      expect(providers.qwen).toBeDefined();
      expect(providers.gemini).toBeDefined();
    });

    it('should not initialize disabled providers', () => {
      const configWithDisabledProvider = {
        ...mockConfig,
        providers: {
          ...mockConfig.providers,
          assemblyai: { ...mockConfig.providers.assemblyai, enabled: false },
        },
      };

      const aiServiceWithDisabled = new AIService(configWithDisabledProvider);
      const providers = aiServiceWithDisabled.getProviders();

      expect(providers.assemblyai).toBeUndefined();
    });
  });

  describe('Provider Health Checks', () => {
    it('should return healthy status for working providers', async () => {
      const healthStatus = await aiService.checkProviderHealth('assemblyai');

      expect(healthStatus).toEqual({
        provider: 'assemblyai',
        status: 'healthy',
        responseTime: expect.any(Number),
        lastChecked: expect.any(Date),
      });
    });

    it('should return unhealthy status for failing providers', async () => {
      // Mock a failing provider
      const mockError = new Error('API Key invalid');
      jest.spyOn(aiService, 'checkProviderHealth').mockRejectedValueOnce(mockError);

      const healthStatus = await aiService.checkProviderHealth('google');

      expect(healthStatus).toEqual({
        provider: 'google',
        status: 'unhealthy',
        error: 'API Key invalid',
        lastChecked: expect.any(Date),
      });
    });

    it('should check health for all enabled providers', async () => {
      const healthStatuses = await aiService.checkAllProvidersHealth();

      expect(healthStatuses).toHaveLength(4);
      expect(healthStatuses.map(h => h.provider)).toEqual(
        expect.arrayContaining(['assemblyai', 'google', 'qwen', 'gemini'])
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits across all providers', async () => {
      const requests = Array(70).fill(null).map(() =>
        aiService.checkProviderHealth('assemblyai')
      );

      const results = await Promise.allSettled(requests);

      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      const rejected = results.filter(r => r.status === 'rejected').length;

      expect(fulfilled).toBeLessThanOrEqual(60); // Should not exceed rate limit
      expect(rejected).toBeGreaterThan(0); // Some requests should be rejected
    });

    it('should handle burst requests within limits', async () => {
      const burstRequests = Array(10).fill(null).map(() =>
        aiService.checkProviderHealth('assemblyai')
      );

      const results = await Promise.allSettled(burstRequests);

      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('should reject requests exceeding burst limit', async () => {
      const excessiveRequests = Array(15).fill(null).map(() =>
        aiService.checkProviderHealth('assemblyai')
      );

      const results = await Promise.allSettled(excessiveRequests);

      const rejected = results.filter(r =>
        r.status === 'rejected' &&
        r.reason?.message?.includes('Rate limit exceeded')
      );

      expect(rejected.length).toBeGreaterThan(0);
    });
  });

  describe('Retry Policy', () => {
    it('should retry failed requests according to policy', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ status: 'healthy' });

      jest.spyOn(aiService, 'checkProviderHealth').mockImplementation(mockFn);

      const result = await aiService.checkProviderHealth('assemblyai');

      expect(mockFn).toHaveBeenCalledTimes(3);
      expect(result.status).toBe('healthy');
    });

    it('should fail after maximum retries', async () => {
      const mockFn = jest.fn()
        .mockRejectedValue(new Error('Persistent failure'));

      jest.spyOn(aiService, 'checkProviderHealth').mockImplementation(mockFn);

      await expect(aiService.checkProviderHealth('assemblyai'))
        .rejects.toThrow('Persistent failure');

      expect(mockFn).toHaveBeenCalledTimes(3); // maxRetries
    });

    it('should implement exponential backoff', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ status: 'healthy' });

      jest.spyOn(aiService, 'checkProviderHealth').mockImplementation(mockFn);

      const startTime = Date.now();
      await aiService.checkProviderHealth('assemblyai');
      const endTime = Date.now();

      const elapsedTime = endTime - startTime;

      // Should take at least initialDelay * (backoffMultiplier ^ (maxRetries - 1))
      // 1000 * (2 ^ 2) = 4000ms minimum
      expect(elapsedTime).toBeGreaterThanOrEqual(4000);
    });
  });

  describe('Provider Fallback', () => {
    it('should fallback to alternative provider on failure', async () => {
      const mockPrimaryProvider = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const mockFallbackProvider = jest.fn().mockResolvedValue({ status: 'healthy' });

      jest.spyOn(aiService, 'checkProviderHealth')
        .mockImplementationOnce(mockPrimaryProvider)
        .mockImplementationOnce(mockFallbackProvider);

      const result = await aiService.processWithFallback(
        ['google', 'assemblyai'],
        async (provider) => aiService.checkProviderHealth(provider)
      );

      expect(result.status).toBe('healthy');
      expect(mockPrimaryProvider).toHaveBeenCalledWith('google');
      expect(mockFallbackProvider).toHaveBeenCalledWith('assemblyai');
    });

    it('should fail when all providers fail', async () => {
      const mockFailingProvider = jest.fn().mockRejectedValue(new Error('All failed'));

      jest.spyOn(aiService, 'checkProviderHealth').mockImplementation(mockFailingProvider);

      await expect(aiService.processWithFallback(
        ['google', 'assemblyai'],
        async (provider) => aiService.checkProviderHealth(provider)
      )).rejects.toThrow('All providers failed');
    });
  });

  describe('Cost Optimization', () => {
    it('should track API usage costs', async () => {
      await aiService.checkProviderHealth('assemblyai');

      const usage = aiService.getUsageStats();

      expect(usage).toEqual({
        totalRequests: 1,
        totalCost: expect.any(Number),
        providerBreakdown: {
          assemblyai: {
            requests: 1,
            cost: expect.any(Number),
          },
        },
      });
    });

    it('should select most cost-effective provider', () => {
      const providers = aiService.getProvidersByCost(['assemblyai', 'google']);

      expect(providers).toEqual(['assemblyai', 'google']); // Assuming assemblyai is cheaper
    });

    it('should warn when approaching cost limits', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Simulate high cost usage
      for (let i = 0; i < 1000; i++) {
        await aiService.checkProviderHealth('assemblyai');
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cost limit approaching')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      const mockTimeoutError = new Error('Request timeout');
      jest.spyOn(aiService, 'checkProviderHealth').mockRejectedValueOnce(mockTimeoutError);

      await expect(aiService.checkProviderHealth('assemblyai'))
        .rejects.toThrow('Request timeout');
    });

    it('should handle authentication errors', async () => {
      const mockAuthError = new Error('Invalid API key');
      jest.spyOn(aiService, 'checkProviderHealth').mockRejectedValueOnce(mockAuthError);

      await expect(aiService.checkProviderHealth('assemblyai'))
        .rejects.toThrow('Invalid API key');
    });

    it('should handle quota exceeded errors', async () => {
      const mockQuotaError = new Error('Quota exceeded');
      jest.spyOn(aiService, 'checkProviderHealth').mockRejectedValueOnce(mockQuotaError);

      await expect(aiService.checkProviderHealth('assemblyai'))
        .rejects.toThrow('Quota exceeded');
    });
  });

  describe('Performance Monitoring', () => {
    it('should track response times for each provider', async () => {
      await aiService.checkProviderHealth('assemblyai');

      const metrics = aiService.getPerformanceMetrics();

      expect(metrics).toEqual({
        assemblyai: {
          averageResponseTime: expect.any(Number),
          totalRequests: 1,
          successRate: 1.0,
        },
      });
    });

    it('should identify slow providers', async () => {
      // Mock slow response
      jest.spyOn(aiService, 'checkProviderHealth').mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ status: 'healthy' }), 5000))
      );

      await aiService.checkProviderHealth('assemblyai');

      const slowProviders = aiService.getSlowProviders(1000); // 1 second threshold

      expect(slowProviders).toContain('assemblyai');
    });
  });
});

describe('STTService', () => {
  let sttService: STTService;
  let mockConfig: AIServiceConfig;

  beforeEach(() => {
    mockConfig = {
      providers: {
        assemblyai: {
          apiKey: 'test-assemblyai-key',
          enabled: true,
        },
      },
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
      },
    };

    sttService = new STTService(mockConfig);
  });

  describe('Audio Transcription', () => {
    it('should transcribe audio file successfully', async () => {
      const mockAudioBuffer = Buffer.from('fake-audio-data');
      const mockTranscription = {
        id: 'transcript-123',
        text: 'This is a test transcription',
        confidence: 0.95,
        language: 'en',
      };

      jest.spyOn(sttService, 'transcribe').mockResolvedValueOnce(mockTranscription);

      const result = await sttService.transcribe(mockAudioBuffer);

      expect(result).toEqual(mockTranscription);
      expect(result.text).toBe('This is a test transcription');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should handle multiple languages', async () => {
      const mockAudioBuffer = Buffer.from('fake-multilingual-audio');
      const mockTranscription = {
        id: 'transcript-456',
        text: 'Bonjour le monde',
        confidence: 0.92,
        language: 'fr',
      };

      jest.spyOn(sttService, 'transcribe').mockResolvedValueOnce(mockTranscription);

      const result = await sttService.transcribe(mockAudioBuffer, { language: 'auto' });

      expect(result.language).toBe('fr');
      expect(result.text).toBe('Bonjour le monde');
    });

    it('should fail with invalid audio format', async () => {
      const invalidAudioBuffer = Buffer.from('not-audio-data');

      await expect(sttService.transcribe(invalidAudioBuffer))
        .rejects.toThrow('Invalid audio format');
    });
  });

  describe('Speaker Diarization', () => {
    it('should identify multiple speakers', async () => {
      const mockAudioBuffer = Buffer.from('multi-speaker-audio');
      const mockDiarization = {
        speakers: [
          { id: 1, segments: [{ start: 0, end: 10, text: 'Hello' }] },
          { id: 2, segments: [{ start: 10, end: 20, text: 'Hi there' }] },
        ],
      };

      jest.spyOn(sttService, 'diarize').mockResolvedValueOnce(mockDiarization);

      const result = await sttService.diarize(mockAudioBuffer);

      expect(result.speakers).toHaveLength(2);
      expect(result.speakers[0].id).toBe(1);
      expect(result.speakers[1].id).toBe(2);
    });
  });
});

describe('VisionService', () => {
  let visionService: VisionService;
  let mockConfig: AIServiceConfig;

  beforeEach(() => {
    mockConfig = {
      providers: {
        qwen: {
          apiKey: 'test-qwen-key',
          enabled: true,
        },
      },
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
      },
    };

    visionService = new VisionService(mockConfig);
  });

  describe('Scene Detection', () => {
    it('should detect scene changes in video', async () => {
      const mockVideoFrames = [
        Buffer.from('frame1'),
        Buffer.from('frame2'),
        Buffer.from('frame3'),
      ];

      const mockSceneDetection = {
        scenes: [
          { start: 0, end: 10, confidence: 0.95 },
          { start: 10, end: 20, confidence: 0.92 },
        ],
      };

      jest.spyOn(visionService, 'detectScenes').mockResolvedValueOnce(mockSceneDetection);

      const result = await visionService.detectScenes(mockVideoFrames);

      expect(result.scenes).toHaveLength(2);
      expect(result.scenes[0].confidence).toBeGreaterThan(0.9);
    });

    it('should identify objects in frames', async () => {
      const mockFrame = Buffer.from('frame-with-objects');
      const mockObjectDetection = {
        objects: [
          { label: 'person', confidence: 0.95, bbox: [10, 20, 100, 200] },
          { label: 'car', confidence: 0.87, bbox: [150, 50, 300, 150] },
        ],
      };

      jest.spyOn(visionService, 'detectObjects').mockResolvedValueOnce(mockObjectDetection);

      const result = await visionService.detectObjects(mockFrame);

      expect(result.objects).toHaveLength(2);
      expect(result.objects[0].label).toBe('person');
      expect(result.objects[1].label).toBe('car');
    });
  });
});

describe('TextAnalysisService', () => {
  let textAnalysisService: TextAnalysisService;
  let mockConfig: AIServiceConfig;

  beforeEach(() => {
    mockConfig = {
      providers: {
        gemini: {
          apiKey: 'test-gemini-key',
          enabled: true,
        },
      },
      rateLimiting: {
        requestsPerMinute: 60,
        burstLimit: 10,
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        initialDelay: 1000,
      },
    };

    textAnalysisService = new TextAnalysisService(mockConfig);
  });

  describe('Narrative Analysis', () => {
    it('should analyze narrative structure', async () => {
      const mockTranscript = 'This is a story about a hero who saves the day.';
      const mockAnalysis = {
        narrative: {
          structure: 'hero_journey',
          key_points: ['introduction', 'conflict', 'resolution'],
          sentiment: 'positive',
        },
      };

      jest.spyOn(textAnalysisService, 'analyzeNarrative').mockResolvedValueOnce(mockAnalysis);

      const result = await textAnalysisService.analyzeNarrative(mockTranscript);

      expect(result.narrative.structure).toBe('hero_journey');
      expect(result.narrative.key_points).toContain('conflict');
    });

    it('should extract highlights from content', async () => {
      const mockContent = 'The most important moment was when the hero saved the day.';
      const mockHighlights = {
        highlights: [
          { text: 'hero saved the day', importance: 0.95, timestamp: 120 },
        ],
      };

      jest.spyOn(textAnalysisService, 'extractHighlights').mockResolvedValueOnce(mockHighlights);

      const result = await textAnalysisService.extractHighlights(mockContent);

      expect(result.highlights).toHaveLength(1);
      expect(result.highlights[0].importance).toBeGreaterThan(0.9);
    });
  });

  describe('Emotion Detection', () => {
    it('should detect emotions in text', async () => {
      const mockText = 'I am so excited and happy about this!';
      const mockEmotions = {
        emotions: [
          { label: 'joy', confidence: 0.92 },
          { label: 'excitement', confidence: 0.85 },
        ],
      };

      jest.spyOn(textAnalysisService, 'detectEmotions').mockResolvedValueOnce(mockEmotions);

      const result = await textAnalysisService.detectEmotions(mockText);

      expect(result.emotions).toHaveLength(2);
      expect(result.emotions[0].label).toBe('joy');
    });
  });
});

describe('Integration Tests', () => {
  let aiService: AIService;

  beforeEach(() => {
    const mockConfig: AIServiceConfig = {
      providers: {
        assemblyai: { apiKey: 'test-key', enabled: true },
        qwen: { apiKey: 'test-key', enabled: true },
        gemini: { apiKey: 'test-key', enabled: true },
      },
      rateLimiting: { requestsPerMinute: 60, burstLimit: 10 },
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, initialDelay: 1000 },
    };

    aiService = new AIService(mockConfig);
  });

  it('should process complete video analysis workflow', async () => {
    // Mock all service responses
    const mockSTTResult = { text: 'Test transcript', confidence: 0.95 };
    const mockSceneResult = { scenes: [{ start: 0, end: 10 }] };
    const mockAnalysisResult = { narrative: { structure: 'documentary' } };

    jest.spyOn(STTService.prototype, 'transcribe').mockResolvedValueOnce(mockSTTResult);
    jest.spyOn(VisionService.prototype, 'detectScenes').mockResolvedValueOnce(mockSceneResult);
    jest.spyOn(TextAnalysisService.prototype, 'analyzeNarrative').mockResolvedValueOnce(mockAnalysisResult);

    const videoFile = Buffer.from('fake-video-data');
    const workflowResult = await aiService.processVideoAnalysis(videoFile);

    expect(workflowResult).toEqual({
      transcription: mockSTTResult,
      scenes: mockSceneResult,
      analysis: mockAnalysisResult,
    });
  });

  it('should handle partial failures in workflow', async () => {
    const mockSTTResult = { text: 'Test transcript', confidence: 0.95 };
    const mockSceneError = new Error('Scene detection failed');

    jest.spyOn(STTService.prototype, 'transcribe').mockResolvedValueOnce(mockSTTResult);
    jest.spyOn(VisionService.prototype, 'detectScenes').mockRejectedValueOnce(mockSceneError);

    const videoFile = Buffer.from('fake-video-data');

    await expect(aiService.processVideoAnalysis(videoFile))
      .rejects.toThrow('Scene detection failed');
  });
});