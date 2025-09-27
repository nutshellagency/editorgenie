import { STTService, STTConfig } from './sttService';
import { VisionService, VisionConfig } from './visionService';
import { TextAnalysisService, TextAnalysisConfig } from './textAnalysisService';

export interface AIProviderConfig {
  apiKey: string;
  enabled: boolean;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface AIServiceConfig {
  providers: {
    assemblyai?: AIProviderConfig;
    google?: AIProviderConfig;
    qwen?: AIProviderConfig;
    gemini?: AIProviderConfig;
  };
  rateLimiting: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
    initialDelay: number;
  };
  costLimits?: {
    monthlyBudget: number;
    warningThreshold: number;
  };
}

export interface AIProvider {
  name: string;
  status: 'healthy' | 'unhealthy' | 'disabled';
  lastChecked?: Date;
  responseTime?: number;
  error?: string;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  provider?: string;
  responseTime?: number;
  cost?: number;
}

export interface HealthCheckResult {
  provider: string;
  status: 'healthy' | 'unhealthy';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export interface UsageStats {
  totalRequests: number;
  totalCost: number;
  providerBreakdown: Record<string, {
    requests: number;
    cost: number;
  }>;
}

export interface PerformanceMetrics {
  [provider: string]: {
    averageResponseTime: number;
    totalRequests: number;
    successRate: number;
  };
}

export class AIService {
  private config: AIServiceConfig;
  private providers: Map<string, any> = new Map();
  private requestQueue: Array<{ resolve: Function; reject: Function; fn: Function }> = [];
  private processingQueue = false;
  private requestCount = new Map<string, number[]>();
  private usageStats: UsageStats = {
    totalRequests: 0,
    totalCost: 0,
    providerBreakdown: {},
  };
  private performanceMetrics: PerformanceMetrics = {};

  constructor(config: AIServiceConfig) {
    this.validateConfig(config);
    this.config = config;
    this.initializeProviders();
    this.startQueueProcessor();
  }

  private validateConfig(config: AIServiceConfig): void {
    if (!config.providers || Object.keys(config.providers).length === 0) {
      throw new Error('At least one AI provider must be configured');
    }

    if (!config.rateLimiting || !config.retryPolicy) {
      throw new Error('Rate limiting and retry policy must be configured');
    }

    // Validate rate limiting configuration
    if (config.rateLimiting.requestsPerMinute <= 0 || config.rateLimiting.burstLimit <= 0) {
      throw new Error('Invalid rate limiting configuration');
    }

    // Validate retry policy
    if (config.retryPolicy.maxRetries <= 0 || config.retryPolicy.initialDelay <= 0) {
      throw new Error('Invalid retry policy configuration');
    }
  }

  private initializeProviders(): void {
    const { providers } = this.config;

    if (providers.assemblyai?.enabled) {
      const sttConfig = {
        apiKey: providers.assemblyai.apiKey,
        baseUrl: providers.assemblyai.baseUrl,
        timeout: providers.assemblyai.timeout || 30000,
      };
      this.providers.set('assemblyai', new STTService(sttConfig));
    }

    if (providers.qwen?.enabled) {
      const visionConfig = {
        apiKey: providers.qwen.apiKey,
        baseUrl: providers.qwen.baseUrl,
        timeout: providers.qwen.timeout || 30000,
      };
      this.providers.set('qwen', new VisionService(visionConfig));
    }

    if (providers.gemini?.enabled) {
      const textConfig = {
        apiKey: providers.gemini.apiKey,
        baseUrl: providers.gemini.baseUrl,
        timeout: providers.gemini.timeout || 30000,
      };
      this.providers.set('gemini', new TextAnalysisService(textConfig));
    }

    if (providers.google?.enabled) {
      const sttConfig = {
        apiKey: providers.google.apiKey,
        baseUrl: providers.google.baseUrl,
        timeout: providers.google.timeout || 30000,
      };
      this.providers.set('google', new STTService(sttConfig));
    }
  }

  private startQueueProcessor(): void {
    if (this.processingQueue) return;

    this.processingQueue = true;
    setInterval(() => {
      this.processQueue();
    }, 1000); // Process queue every second
  }

  private async processQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old request counts
    for (const [provider, timestamps] of Array.from(this.requestCount.entries())) {
      this.requestCount.set(provider, timestamps.filter(t => t > oneMinuteAgo));
    }

    // Check if we can process more requests
    const totalRequestsLastMinute = Array.from(this.requestCount.values())
      .flat()
      .filter(t => t > oneMinuteAgo).length;

    if (totalRequestsLastMinute >= this.config.rateLimiting.requestsPerMinute) {
      return; // Rate limit exceeded
    }

    // Process one request from queue
    const request = this.requestQueue.shift();
    if (request) {
      try {
        const result = await request.fn();
        request.resolve(result);
      } catch (error) {
        request.reject(error);
      }
    }
  }

  private async enqueueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject, fn });
    });
  }

  private canMakeRequest(provider: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const providerRequests = this.requestCount.get(provider) || [];
    const recentRequests = providerRequests.filter(t => t > oneMinuteAgo);

    return recentRequests.length < this.config.rateLimiting.burstLimit;
  }

  private recordRequest(provider: string, responseTime: number, cost: number = 0): void {
    const now = Date.now();

    // Record request timestamp
    if (!this.requestCount.has(provider)) {
      this.requestCount.set(provider, []);
    }
    this.requestCount.get(provider)!.push(now);

    // Update usage stats
    this.usageStats.totalRequests++;
    this.usageStats.totalCost += cost;

    if (!this.usageStats.providerBreakdown[provider]) {
      this.usageStats.providerBreakdown[provider] = { requests: 0, cost: 0 };
    }
    this.usageStats.providerBreakdown[provider].requests++;
    this.usageStats.providerBreakdown[provider].cost += cost;

    // Update performance metrics
    if (!this.performanceMetrics[provider]) {
      this.performanceMetrics[provider] = {
        averageResponseTime: 0,
        totalRequests: 0,
        successRate: 0,
      };
    }

    const metrics = this.performanceMetrics[provider];
    metrics.totalRequests++;
    metrics.averageResponseTime =
      (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
    metrics.successRate = metrics.totalRequests / metrics.totalRequests; // Simplified for now
  }

  async checkProviderHealth(provider: string): Promise<HealthCheckResult> {
    if (!this.providers.has(provider)) {
      return {
        provider,
        status: 'unhealthy',
        lastChecked: new Date(),
        error: 'Provider not configured',
      };
    }

    const startTime = Date.now();

    try {
      const providerService = this.providers.get(provider);
      await providerService.healthCheck();

      const responseTime = Date.now() - startTime;

      return {
        provider,
        status: 'healthy',
        responseTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        provider,
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkAllProvidersHealth(): Promise<HealthCheckResult[]> {
    const healthChecks = Array.from(this.providers.keys()).map(provider =>
      this.checkProviderHealth(provider)
    );

    return Promise.all(healthChecks);
  }

  async processWithFallback<T>(
    providers: string[],
    fn: (provider: string) => Promise<T>
  ): Promise<T> {
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        return await fn(provider);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${provider}: ${errorMessage}`);
      }
    }

    throw new Error(`All providers failed: ${errors.join(', ')}`);
  }

  getProviders(): Record<string, any> {
    const providers: Record<string, any> = {};
    for (const [name, service] of Array.from(this.providers.entries())) {
      providers[name] = service;
    }
    return providers;
  }

  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  getUsageStats(): UsageStats {
    return { ...this.usageStats };
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getSlowProviders(thresholdMs: number): string[] {
    return Object.entries(this.performanceMetrics)
      .filter(([, metrics]) => metrics.averageResponseTime > thresholdMs)
      .map(([provider]) => provider);
  }

  getProvidersByCost(providers: string[]): string[] {
    // Simplified cost-based sorting - in real implementation,
    // this would use actual cost data from each provider
    const costOrder = ['assemblyai', 'google', 'qwen', 'gemini'];
    return providers.sort((a, b) => {
      const indexA = costOrder.indexOf(a);
      const indexB = costOrder.indexOf(b);
      return indexA - indexB;
    });
  }

  // Video processing workflow
  async processVideoAnalysis(videoFile: Buffer): Promise<{
    transcription?: any;
    scenes?: any;
    analysis?: any;
  }> {
    const results: any = {};

    try {
      // Step 1: Extract and transcribe audio
      if (this.providers.has('assemblyai')) {
        const sttService = this.providers.get('assemblyai') as STTService;
        const audioBuffer = await this.extractAudioFromVideo(videoFile);
        results.transcription = await sttService.transcribe(audioBuffer);
      }

      // Step 2: Detect scenes and objects
      if (this.providers.has('qwen')) {
        const visionService = this.providers.get('qwen') as VisionService;
        const frames = await this.extractFramesFromVideo(videoFile);
        results.scenes = await visionService.detectScenes(frames);
      }

      // Step 3: Analyze content
      if (this.providers.has('gemini') && results.transcription) {
        const textService = this.providers.get('gemini') as TextAnalysisService;
        results.analysis = await textService.analyzeNarrative(results.transcription.text);
      }

      return results;
    } catch (error) {
      throw new Error(`Video analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractAudioFromVideo(videoFile: Buffer): Promise<Buffer> {
    // Placeholder for audio extraction logic
    // In real implementation, this would use FFmpeg or similar
    return videoFile; // Simplified for now
  }

  private async extractFramesFromVideo(videoFile: Buffer): Promise<Buffer[]> {
    // Placeholder for frame extraction logic
    // In real implementation, this would use FFmpeg or similar
    return [videoFile]; // Simplified for now
  }
}