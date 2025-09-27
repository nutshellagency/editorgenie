import { AIService } from './aiService';
import { STTService } from './sttService';
import { VisionService } from './visionService';
import { TextAnalysisService } from './textAnalysisService';
import { EmotionAnalysisService } from './emotionAnalysisService';

export interface ModelVersion {
  id: string;
  provider: 'assemblyai' | 'google' | 'qwen' | 'gemini' | 'openai';
  model_name: string;
  version: string;
  capabilities: string[];
  performance_metrics: {
    accuracy: number;
    latency: number;
    cost_per_request: number;
    availability: number;
  };
  status: 'active' | 'deprecated' | 'experimental' | 'maintenance';
  fallback_priority: number;
  last_updated: Date;
  config: Record<string, any>;
}

export interface ServiceEndpoint {
  id: string;
  provider: string;
  endpoint: string;
  api_key: string;
  rate_limits: {
    requests_per_minute: number;
    requests_per_hour: number;
    burst_limit: number;
  };
  timeout: number;
  retries: number;
  health_check_interval: number;
  last_health_check: Date;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance';
}

export interface FallbackStrategy {
  id: string;
  name: string;
  description: string;
  conditions: Array<{
    metric: 'accuracy' | 'latency' | 'error_rate' | 'cost';
    operator: '>' | '<' | '>=' | '<=' | '==';
    threshold: number;
  }>;
  actions: Array<{
    type: 'switch_provider' | 'reduce_quality' | 'cache_result' | 'skip_processing';
    target?: string;
    config?: Record<string, any>;
  }>;
  cooldown_period: number;
  priority: number;
}

export interface ModelPerformanceMetrics {
  model_id: string;
  timestamp: Date;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_latency: number;
  p95_latency: number;
  p99_latency: number;
  accuracy_score: number;
  cost_total: number;
  cost_per_request: number;
  error_rate: number;
  cache_hit_rate: number;
}

export class ModelVersionManager {
  private aiService: AIService;
  private modelVersions: Map<string, ModelVersion> = new Map();
  private serviceEndpoints: Map<string, ServiceEndpoint> = new Map();
  private fallbackStrategies: Map<string, FallbackStrategy> = new Map();
  private performanceMetrics: Map<string, ModelPerformanceMetrics[]> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.initializeDefaultConfigurations();
    this.startHealthMonitoring();
    this.startMetricsCollection();
  }

  /**
   * Initialize default model versions and configurations
   */
  private initializeDefaultConfigurations(): void {
    // AssemblyAI models for speech-to-text
    this.registerModelVersion({
      id: 'assemblyai-latest',
      provider: 'assemblyai',
      model_name: 'assemblyai-v2',
      version: '2.0.0',
      capabilities: ['transcription', 'diarization', 'sentiment_analysis'],
      performance_metrics: {
        accuracy: 0.95,
        latency: 2000,
        cost_per_request: 0.001,
        availability: 0.99
      },
      status: 'active',
      fallback_priority: 1,
      last_updated: new Date(),
      config: {
        language_support: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
        features: ['speaker_diarization', 'sentiment_analysis', 'entity_detection']
      }
    });

    // Qwen Vision models for computer vision
    this.registerModelVersion({
      id: 'qwen-vision-latest',
      provider: 'qwen',
      model_name: 'qwen-vision-v1',
      version: '1.0.0',
      capabilities: ['object_detection', 'scene_analysis', 'face_detection', 'emotion_recognition'],
      performance_metrics: {
        accuracy: 0.92,
        latency: 1500,
        cost_per_request: 0.002,
        availability: 0.98
      },
      status: 'active',
      fallback_priority: 1,
      last_updated: new Date(),
      config: {
        max_resolution: '1920x1080',
        supported_formats: ['jpg', 'png', 'webp'],
        features: ['object_tracking', 'scene_classification', 'emotion_detection']
      }
    });

    // Gemini Pro models for text analysis
    this.registerModelVersion({
      id: 'gemini-pro-latest',
      provider: 'gemini',
      model_name: 'gemini-pro',
      version: '1.0.0',
      capabilities: ['text_analysis', 'narrative_analysis', 'sentiment_analysis', 'summarization'],
      performance_metrics: {
        accuracy: 0.94,
        latency: 1000,
        cost_per_request: 0.0005,
        availability: 0.995
      },
      status: 'active',
      fallback_priority: 1,
      last_updated: new Date(),
      config: {
        max_tokens: 8192,
        temperature: 0.7,
        features: ['narrative_structure', 'keyword_extraction', 'entity_recognition']
      }
    });

    // OpenAI GPT models as fallback
    this.registerModelVersion({
      id: 'gpt-4-fallback',
      provider: 'openai',
      model_name: 'gpt-4',
      version: '4.0.0',
      capabilities: ['text_analysis', 'summarization', 'general_nlp'],
      performance_metrics: {
        accuracy: 0.90,
        latency: 3000,
        cost_per_request: 0.03,
        availability: 0.99
      },
      status: 'active',
      fallback_priority: 2,
      last_updated: new Date(),
      config: {
        max_tokens: 4096,
        temperature: 0.7,
        features: ['general_analysis', 'summarization']
      }
    });

    // Initialize service endpoints
    this.registerServiceEndpoint({
      id: 'assemblyai-primary',
      provider: 'assemblyai',
      endpoint: 'https://api.assemblyai.com/v2',
      api_key: process.env.ASSEMBLYAI_API_KEY || '',
      rate_limits: {
        requests_per_minute: 60,
        requests_per_hour: 1000,
        burst_limit: 10
      },
      timeout: 30000,
      retries: 3,
      health_check_interval: 60000,
      last_health_check: new Date(),
      status: 'healthy'
    });

    this.registerServiceEndpoint({
      id: 'qwen-primary',
      provider: 'qwen',
      endpoint: 'https://api.qwen.com/v1',
      api_key: process.env.QWEN_API_KEY || '',
      rate_limits: {
        requests_per_minute: 30,
        requests_per_hour: 500,
        burst_limit: 5
      },
      timeout: 45000,
      retries: 3,
      health_check_interval: 60000,
      last_health_check: new Date(),
      status: 'healthy'
    });

    this.registerServiceEndpoint({
      id: 'gemini-primary',
      provider: 'gemini',
      endpoint: 'https://generativelanguage.googleapis.com/v1',
      api_key: process.env.GEMINI_API_KEY || '',
      rate_limits: {
        requests_per_minute: 60,
        requests_per_hour: 1000,
        burst_limit: 15
      },
      timeout: 30000,
      retries: 3,
      health_check_interval: 60000,
      last_health_check: new Date(),
      status: 'healthy'
    });

    // Initialize fallback strategies
    this.registerFallbackStrategy({
      id: 'high_latency_fallback',
      name: 'High Latency Fallback',
      description: 'Switch to faster provider when latency exceeds threshold',
      conditions: [
        {
          metric: 'latency',
          operator: '>',
          threshold: 5000
        }
      ],
      actions: [
        {
          type: 'switch_provider',
          target: 'faster_alternative',
          config: { max_latency: 3000 }
        }
      ],
      cooldown_period: 300000, // 5 minutes
      priority: 1
    });

    this.registerFallbackStrategy({
      id: 'low_accuracy_fallback',
      name: 'Low Accuracy Fallback',
      description: 'Switch to more accurate provider when accuracy drops',
      conditions: [
        {
          metric: 'accuracy',
          operator: '<',
          threshold: 0.8
        }
      ],
      actions: [
        {
          type: 'switch_provider',
          target: 'higher_accuracy',
          config: { min_accuracy: 0.9 }
        }
      ],
      cooldown_period: 600000, // 10 minutes
      priority: 2
    });

    this.registerFallbackStrategy({
      id: 'cost_optimization',
      name: 'Cost Optimization',
      description: 'Switch to cost-effective provider during high usage',
      conditions: [
        {
          metric: 'cost',
          operator: '>',
          threshold: 0.01
        }
      ],
      actions: [
        {
          type: 'switch_provider',
          target: 'cost_effective',
          config: { max_cost_per_request: 0.005 }
        }
      ],
      cooldown_period: 1800000, // 30 minutes
      priority: 3
    });
  }

  /**
   * Register a new model version
   */
  registerModelVersion(version: ModelVersion): void {
    this.modelVersions.set(version.id, version);
    this.initializePerformanceMetrics(version.id);
  }

  /**
   * Register a service endpoint
   */
  registerServiceEndpoint(endpoint: ServiceEndpoint): void {
    this.serviceEndpoints.set(endpoint.id, endpoint);
  }

  /**
   * Register a fallback strategy
   */
  registerFallbackStrategy(strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(strategy.id, strategy);
  }

  /**
   * Get the best available model for a specific capability
   */
  getBestModel(capability: string, constraints?: {
    max_latency?: number;
    min_accuracy?: number;
    max_cost?: number;
  }): ModelVersion | null {
    const availableModels = Array.from(this.modelVersions.values())
      .filter(model =>
        model.status === 'active' &&
        model.capabilities.includes(capability)
      );

    if (availableModels.length === 0) {
      return null;
    }

    // Sort by fallback priority and performance
    availableModels.sort((a, b) => {
      // First by fallback priority
      if (a.fallback_priority !== b.fallback_priority) {
        return a.fallback_priority - b.fallback_priority;
      }

      // Then by accuracy
      if (constraints?.min_accuracy) {
        if (a.performance_metrics.accuracy >= constraints.min_accuracy &&
            b.performance_metrics.accuracy < constraints.min_accuracy) {
          return -1;
        }
        if (b.performance_metrics.accuracy >= constraints.min_accuracy &&
            a.performance_metrics.accuracy < constraints.min_accuracy) {
          return 1;
        }
      }

      // Then by latency
      if (constraints?.max_latency) {
        if (a.performance_metrics.latency <= constraints.max_latency &&
            b.performance_metrics.latency > constraints.max_latency) {
          return -1;
        }
        if (b.performance_metrics.latency <= constraints.max_latency &&
            a.performance_metrics.latency > constraints.max_latency) {
          return 1;
        }
      }

      // Finally by cost
      return a.performance_metrics.cost_per_request - b.performance_metrics.cost_per_request;
    });

    return availableModels[0];
  }

  /**
   * Execute request with automatic fallback handling
   */
  async executeWithFallback<T>(
    operation: string,
    requestFn: (model: ModelVersion, endpoint: ServiceEndpoint) => Promise<T>,
    options: {
      capability: string;
      constraints?: {
        max_latency?: number;
        min_accuracy?: number;
        max_cost?: number;
      };
      max_fallbacks?: number;
    } = { capability: '', max_fallbacks: 3 }
  ): Promise<T> {
    const { capability, constraints, max_fallbacks = 3 } = options;
    const attemptedModels: string[] = [];
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < max_fallbacks; attempt++) {
      try {
        // Get the best available model
        const model = this.getBestModel(capability, constraints);
        if (!model) {
          throw new Error(`No available model found for capability: ${capability}`);
        }

        if (attemptedModels.includes(model.id)) {
          continue; // Skip already attempted models
        }

        attemptedModels.push(model.id);

        // Get the corresponding service endpoint
        const endpoint = this.getEndpointForProvider(model.provider);
        if (!endpoint) {
          throw new Error(`No endpoint available for provider: ${model.provider}`);
        }

        // Check if endpoint is healthy
        if (endpoint.status !== 'healthy') {
          throw new Error(`Endpoint ${endpoint.id} is not healthy`);
        }

        // Execute the request
        const startTime = Date.now();
        const result = await requestFn(model, endpoint);
        const latency = Date.now() - startTime;

        // Record successful metrics
        this.recordMetrics(model.id, {
          success: true,
          latency,
          cost: model.performance_metrics.cost_per_request
        });

        return result;

      } catch (error) {
        lastError = error as Error;

        // Record failed metrics
        const failedModel = this.modelVersions.get(attemptedModels[attemptedModels.length - 1]);
        if (failedModel) {
          this.recordMetrics(failedModel.id, {
            success: false,
            error: lastError.message
          });
        }

        // Check if we should apply fallback strategies
        await this.evaluateFallbackStrategies(capability, lastError);

        // If this was the last attempt, throw the error
        if (attempt === max_fallbacks - 1) {
          throw lastError;
        }
      }
    }

    throw lastError || new Error('All fallback attempts exhausted');
  }

  /**
   * Get service endpoint for a provider
   */
  private getEndpointForProvider(provider: string): ServiceEndpoint | null {
    const endpoints = Array.from(this.serviceEndpoints.values())
      .filter(endpoint => endpoint.provider === provider && endpoint.status === 'healthy');

    // Return the first healthy endpoint
    return endpoints.length > 0 ? endpoints[0] : null;
  }

  /**
   * Evaluate and apply fallback strategies
   */
  private async evaluateFallbackStrategies(capability: string, error: Error): Promise<void> {
    const strategies = Array.from(this.fallbackStrategies.values())
      .sort((a, b) => a.priority - b.priority);

    for (const strategy of strategies) {
      if (await this.shouldApplyStrategy(strategy, error)) {
        await this.applyFallbackStrategy(strategy, capability);
        break; // Apply only the highest priority strategy
      }
    }
  }

  /**
   * Check if a fallback strategy should be applied
   */
  private async shouldApplyStrategy(strategy: FallbackStrategy, error: Error): Promise<boolean> {
    // This would check current metrics against strategy conditions
    // For now, return true if error indicates a service issue
    return error.message.includes('timeout') ||
           error.message.includes('rate limit') ||
           error.message.includes('service unavailable');
  }

  /**
   * Apply a fallback strategy
   */
  private async applyFallbackStrategy(strategy: FallbackStrategy, capability: string): Promise<void> {
    for (const action of strategy.actions) {
      switch (action.type) {
        case 'switch_provider':
          await this.switchToAlternativeProvider(action, capability);
          break;
        case 'reduce_quality':
          await this.reduceQualitySettings(action);
          break;
        case 'cache_result':
          await this.enableResultCaching(action);
          break;
        case 'skip_processing':
          await this.skipProcessing(action);
          break;
      }
    }
  }

  /**
   * Switch to alternative provider
   */
  private async switchToAlternativeProvider(action: any, capability: string): Promise<void> {
    // Find alternative providers for the capability
    const alternativeModels = Array.from(this.modelVersions.values())
      .filter(model =>
        model.status === 'active' &&
        model.capabilities.includes(capability) &&
        model.fallback_priority > 1
      );

    if (alternativeModels.length > 0) {
      // Switch to the next best alternative
      const alternative = alternativeModels.sort((a, b) =>
        a.fallback_priority - b.fallback_priority
      )[0];

      console.log(`Switching to alternative provider: ${alternative.provider} for capability: ${capability}`);
    }
  }

  /**
   * Reduce quality settings to improve performance
   */
  private async reduceQualitySettings(action: any): Promise<void> {
    // Reduce model parameters or switch to faster but less accurate models
    console.log('Reducing quality settings to improve performance');
  }

  /**
   * Enable result caching
   */
  private async enableResultCaching(action: any): Promise<void> {
    // Enable caching for subsequent similar requests
    console.log('Enabling result caching');
  }

  /**
   * Skip processing for non-critical operations
   */
  private async skipProcessing(action: any): Promise<void> {
    // Skip processing for operations that can be deferred
    console.log('Skipping non-critical processing');
  }

  /**
   * Start health monitoring for all endpoints
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 60000); // Check every minute
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    const endpoints = Array.from(this.serviceEndpoints.values());

    for (const endpoint of endpoints) {
      try {
        const isHealthy = await this.checkEndpointHealth(endpoint);
        endpoint.status = isHealthy ? 'healthy' : 'unhealthy';
        endpoint.last_health_check = new Date();
      } catch (error) {
        endpoint.status = 'unhealthy';
        endpoint.last_health_check = new Date();
      }
    }
  }

  /**
   * Check health of a specific endpoint
   */
  private async checkEndpointHealth(endpoint: ServiceEndpoint): Promise<boolean> {
    try {
      // Perform a simple health check request
      const response = await fetch(`${endpoint.endpoint}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${endpoint.api_key}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.collectAndAggregateMetrics();
    }, 300000); // Collect every 5 minutes
  }

  /**
   * Collect and aggregate performance metrics
   */
  private collectAndAggregateMetrics(): void {
    const modelIds = Array.from(this.modelVersions.keys());

    for (const modelId of modelIds) {
      const metrics = this.performanceMetrics.get(modelId) || [];
      const recentMetrics = metrics.slice(-100); // Last 100 data points

      if (recentMetrics.length > 0) {
        const aggregated = this.aggregateMetrics(recentMetrics);
        this.updateModelPerformance(modelId, aggregated);
      }
    }
  }

  /**
   * Aggregate metrics from recent data points
   */
  private aggregateMetrics(metrics: ModelPerformanceMetrics[]): {
    accuracy: number;
    latency: number;
    cost_per_request: number;
    availability: number;
  } {
    const successfulMetrics = metrics.filter(m => m.successful_requests > 0);

    if (successfulMetrics.length === 0) {
      return {
        accuracy: 0,
        latency: 0,
        cost_per_request: 0,
        availability: 0
      };
    }

    const totalRequests = metrics.reduce((sum, m) => sum + m.total_requests, 0);
    const successfulRequests = metrics.reduce((sum, m) => sum + m.successful_requests, 0);
    const avgLatency = metrics.reduce((sum, m) => sum + m.average_latency, 0) / metrics.length;
    const totalCost = metrics.reduce((sum, m) => sum + m.cost_total, 0);
    const avgAccuracy = metrics.reduce((sum, m) => sum + m.accuracy_score, 0) / successfulMetrics.length;

    return {
      accuracy: avgAccuracy,
      latency: avgLatency,
      cost_per_request: totalCost / totalRequests,
      availability: successfulRequests / totalRequests
    };
  }

  /**
   * Update model performance metrics
   */
  private updateModelPerformance(modelId: string, aggregated: any): void {
    const model = this.modelVersions.get(modelId);
    if (model) {
      model.performance_metrics = {
        ...model.performance_metrics,
        ...aggregated
      };
      model.last_updated = new Date();
    }
  }

  /**
   * Initialize performance metrics for a model
   */
  private initializePerformanceMetrics(modelId: string): void {
    this.performanceMetrics.set(modelId, []);
  }

  /**
   * Record metrics for a model
   */
  recordMetrics(modelId: string, data: {
    success: boolean;
    latency?: number;
    cost?: number;
    error?: string;
  }): void {
    const metrics = this.performanceMetrics.get(modelId) || [];
    const timestamp = new Date();

    const newMetric: ModelPerformanceMetrics = {
      model_id: modelId,
      timestamp,
      total_requests: 1,
      successful_requests: data.success ? 1 : 0,
      failed_requests: data.success ? 0 : 1,
      average_latency: data.latency || 0,
      p95_latency: data.latency || 0,
      p99_latency: data.latency || 0,
      accuracy_score: data.success ? 1 : 0,
      cost_total: data.cost || 0,
      cost_per_request: data.cost || 0,
      error_rate: data.success ? 0 : 1,
      cache_hit_rate: 0
    };

    metrics.push(newMetric);

    // Keep only last 1000 metrics
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    this.performanceMetrics.set(modelId, metrics);
  }

  /**
   * Get performance report for all models
   */
  getPerformanceReport(): {
    models: Array<ModelVersion & { recent_metrics: ModelPerformanceMetrics[] }>;
    endpoints: ServiceEndpoint[];
    recommendations: string[];
  } {
    const modelsWithMetrics = Array.from(this.modelVersions.values()).map(model => ({
      ...model,
      recent_metrics: this.performanceMetrics.get(model.id) || []
    }));

    const recommendations = this.generateRecommendations(modelsWithMetrics);

    return {
      models: modelsWithMetrics,
      endpoints: Array.from(this.serviceEndpoints.values()),
      recommendations
    };
  }

  /**
   * Generate recommendations based on performance data
   */
  private generateRecommendations(models: Array<ModelVersion & { recent_metrics: ModelPerformanceMetrics[] }>): string[] {
    const recommendations: string[] = [];

    for (const model of models) {
      const recentMetrics = model.recent_metrics.slice(-10); // Last 10 metrics

      if (recentMetrics.length === 0) continue;

      const avgLatency = recentMetrics.reduce((sum, m) => sum + m.average_latency, 0) / recentMetrics.length;
      const errorRate = recentMetrics.reduce((sum, m) => sum + m.error_rate, 0) / recentMetrics.length;
      const avgAccuracy = recentMetrics.reduce((sum, m) => sum + m.accuracy_score, 0) / recentMetrics.length;

      if (avgLatency > 5000) {
        recommendations.push(`${model.model_name} has high latency (${avgLatency.toFixed(0)}ms). Consider optimization or fallback.`);
      }

      if (errorRate > 0.1) {
        recommendations.push(`${model.model_name} has high error rate (${(errorRate * 100).toFixed(1)}%). Check service health.`);
      }

      if (avgAccuracy < 0.8) {
        recommendations.push(`${model.model_name} has low accuracy (${(avgAccuracy * 100).toFixed(1)}%). Consider model retraining or alternative.`);
      }
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }

  /**
   * Get model version by ID
   */
  getModelVersion(modelId: string): ModelVersion | null {
    return this.modelVersions.get(modelId) || null;
  }

  /**
   * Get all model versions
   */
  getAllModelVersions(): ModelVersion[] {
    return Array.from(this.modelVersions.values());
  }

  /**
   * Get service endpoint by ID
   */
  getServiceEndpoint(endpointId: string): ServiceEndpoint | null {
    return this.serviceEndpoints.get(endpointId) || null;
  }

  /**
   * Get all service endpoints
   */
  getAllServiceEndpoints(): ServiceEndpoint[] {
    return Array.from(this.serviceEndpoints.values());
  }

  /**
   * Update model status
   */
  updateModelStatus(modelId: string, status: ModelVersion['status']): void {
    const model = this.modelVersions.get(modelId);
    if (model) {
      model.status = status;
      model.last_updated = new Date();
    }
  }

  /**
   * Update endpoint status
   */
  updateEndpointStatus(endpointId: string, status: ServiceEndpoint['status']): void {
    const endpoint = this.serviceEndpoints.get(endpointId);
    if (endpoint) {
      endpoint.status = status;
      endpoint.last_health_check = new Date();
    }
  }
}