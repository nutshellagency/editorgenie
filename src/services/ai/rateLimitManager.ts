import { ModelVersionManager, ModelVersion, ServiceEndpoint } from './modelVersionManager';

export interface RateLimitRule {
  id: string;
  name: string;
  provider: string;
  limits: {
    requests_per_second: number;
    requests_per_minute: number;
    requests_per_hour: number;
    requests_per_day: number;
    burst_limit: number;
  };
  priority: number;
  enabled: boolean;
  conditions?: Array<{
    time_range?: { start: string; end: string };
    cost_threshold?: number;
    user_tier?: 'free' | 'premium' | 'enterprise';
    operation_type?: string;
  }>;
}

export interface CostOptimizationRule {
  id: string;
  name: string;
  description: string;
  trigger_conditions: Array<{
    metric: 'daily_cost' | 'hourly_cost' | 'request_cost' | 'queue_size';
    operator: '>' | '<' | '>=' | '<=' | '==';
    threshold: number;
  }>;
  actions: Array<{
    type: 'switch_provider' | 'reduce_batch_size' | 'enable_caching' | 'throttle_requests' | 'queue_requests';
    target?: string;
    config?: Record<string, any>;
  }>;
  priority: number;
  enabled: boolean;
  cooldown_period: number;
}

export interface RequestQueue {
  id: string;
  requests: Array<{
    id: string;
    operation: string;
    priority: number;
    timestamp: Date;
    estimated_cost: number;
    user_id?: string;
    callback: (result: any) => void;
    error_callback: (error: Error) => void;
  }>;
  processing: boolean;
  max_concurrent: number;
  rate_limit_window: number;
  total_cost: number;
}

export interface CostTracker {
  provider: string;
  model: string;
  operation: string;
  cost: number;
  tokens?: number;
  timestamp: Date;
  user_id?: string;
  request_id: string;
  metadata?: Record<string, any>;
}

export interface UsageMetrics {
  timestamp: Date;
  provider: string;
  model: string;
  operation: string;
  request_count: number;
  total_cost: number;
  avg_latency: number;
  error_count: number;
  cache_hits: number;
  cache_misses: number;
}

export class RateLimitManager {
  private modelManager: ModelVersionManager;
  private rateLimitRules: Map<string, RateLimitRule> = new Map();
  private costOptimizationRules: Map<string, CostOptimizationRule> = new Map();
  private requestQueues: Map<string, RequestQueue> = new Map();
  private costTrackers: CostTracker[] = [];
  private usageMetrics: Map<string, UsageMetrics[]> = new Map();
  private requestCounters: Map<string, { count: number; window_start: Date }> = new Map();
  private costOptimizationInterval: NodeJS.Timeout | null = null;
  private metricsCollectionInterval: NodeJS.Timeout | null = null;

  constructor(modelManager: ModelVersionManager) {
    this.modelManager = modelManager;
    this.initializeDefaultRules();
    this.startCostOptimization();
    this.startMetricsCollection();
  }

  /**
   * Initialize default rate limiting and cost optimization rules
   */
  private initializeDefaultRules(): void {
    // Rate limiting rules for different providers
    this.registerRateLimitRule({
      id: 'assemblyai-standard',
      name: 'AssemblyAI Standard Limits',
      provider: 'assemblyai',
      limits: {
        requests_per_second: 2,
        requests_per_minute: 60,
        requests_per_hour: 1000,
        requests_per_day: 10000,
        burst_limit: 5
      },
      priority: 1,
      enabled: true
    });

    this.registerRateLimitRule({
      id: 'qwen-vision-limits',
      name: 'Qwen Vision API Limits',
      provider: 'qwen',
      limits: {
        requests_per_second: 1,
        requests_per_minute: 30,
        requests_per_hour: 500,
        requests_per_day: 5000,
        burst_limit: 3
      },
      priority: 1,
      enabled: true
    });

    this.registerRateLimitRule({
      id: 'gemini-pro-limits',
      name: 'Gemini Pro API Limits',
      provider: 'gemini',
      limits: {
        requests_per_second: 2,
        requests_per_minute: 60,
        requests_per_hour: 1000,
        requests_per_day: 10000,
        burst_limit: 10
      },
      priority: 1,
      enabled: true
    });

    // Cost optimization rules
    this.registerCostOptimizationRule({
      id: 'daily-budget-limit',
      name: 'Daily Budget Protection',
      description: 'Prevent exceeding daily API budget',
      trigger_conditions: [
        {
          metric: 'daily_cost',
          operator: '>',
          threshold: 50.00 // $50 daily limit
        }
      ],
      actions: [
        {
          type: 'switch_provider',
          target: 'cost_effective',
          config: { max_cost_per_request: 0.005 }
        },
        {
          type: 'throttle_requests',
          config: { delay_ms: 2000 }
        }
      ],
      priority: 1,
      enabled: true,
      cooldown_period: 3600000 // 1 hour
    });

    this.registerCostOptimizationRule({
      id: 'high-cost-operation',
      name: 'High Cost Operation Optimization',
      description: 'Optimize expensive operations',
      trigger_conditions: [
        {
          metric: 'request_cost',
          operator: '>',
          threshold: 0.10
        }
      ],
      actions: [
        {
          type: 'reduce_batch_size',
          config: { max_batch_size: 1 }
        },
        {
          type: 'enable_caching',
          config: { cache_ttl: 3600 }
        }
      ],
      priority: 2,
      enabled: true,
      cooldown_period: 1800000 // 30 minutes
    });

    this.registerCostOptimizationRule({
      id: 'queue-optimization',
      name: 'Queue-based Processing',
      description: 'Use queue for cost smoothing',
      trigger_conditions: [
        {
          metric: 'queue_size',
          operator: '>',
          threshold: 10
        }
      ],
      actions: [
        {
          type: 'queue_requests',
          config: { max_concurrent: 3 }
        }
      ],
      priority: 3,
      enabled: true,
      cooldown_period: 600000 // 10 minutes
    });
  }

  /**
   * Register a rate limiting rule
   */
  registerRateLimitRule(rule: RateLimitRule): void {
    this.rateLimitRules.set(rule.id, rule);
  }

  /**
   * Register a cost optimization rule
   */
  registerCostOptimizationRule(rule: CostOptimizationRule): void {
    this.costOptimizationRules.set(rule.id, rule);
  }

  /**
   * Execute request with rate limiting and cost optimization
   */
  async executeWithRateLimit<T>(
    operation: string,
    requestFn: () => Promise<T>,
    options: {
      provider: string;
      model: string;
      user_id?: string;
      priority?: number;
      estimated_cost?: number;
      bypass_queue?: boolean;
    } = { provider: '', model: '', priority: 1 }
  ): Promise<T> {
    const { provider, model, user_id, priority = 1, estimated_cost = 0.01, bypass_queue = false } = options;

    // Check if request should be queued
    if (!bypass_queue && this.shouldQueueRequest(provider, estimated_cost)) {
      return this.queueRequest(operation, requestFn, {
        provider,
        model,
        user_id,
        priority,
        estimated_cost
      });
    }

    // Check rate limits
    await this.checkRateLimits(provider, model);

    // Execute request with cost tracking
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    try {
      const result = await requestFn();
      const latency = Date.now() - startTime;

      // Track successful request
      this.trackRequest({
        provider,
        model,
        operation,
        cost: estimated_cost,
        timestamp: new Date(),
        user_id,
        request_id: requestId,
        metadata: { latency, success: true }
      });


      return result;

    } catch (error) {
      // Track failed request
      this.trackRequest({
        provider,
        model,
        operation,
        cost: 0, // No cost for failed requests
        timestamp: new Date(),
        user_id,
        request_id: requestId,
        metadata: { error: (error as Error).message, success: false }
      });

      throw error;
    }
  }

  /**
   * Check if request should be queued based on current conditions
   */
  private shouldQueueRequest(provider: string, estimated_cost: number): boolean {
    const rules = Array.from(this.costOptimizationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      if (this.evaluateCostRule(rule)) {
        return rule.actions.some(action => action.type === 'queue_requests');
      }
    }

    return false;
  }

  /**
   * Evaluate if a cost optimization rule should trigger
   */
  private evaluateCostRule(rule: CostOptimizationRule): boolean {
    for (const condition of rule.trigger_conditions) {
      const currentValue = this.getCurrentMetricValue(condition.metric);

      switch (condition.operator) {
        case '>':
          if (!(currentValue > condition.threshold)) return false;
          break;
        case '<':
          if (!(currentValue < condition.threshold)) return false;
          break;
        case '>=':
          if (!(currentValue >= condition.threshold)) return false;
          break;
        case '<=':
          if (!(currentValue <= condition.threshold)) return false;
          break;
        case '==':
          if (!(currentValue === condition.threshold)) return false;
          break;
      }
    }

    return true;
  }

  /**
   * Get current value for a metric
   */
  private getCurrentMetricValue(metric: string): number {
    switch (metric) {
      case 'daily_cost':
        return this.getDailyCost();
      case 'hourly_cost':
        return this.getHourlyCost();
      case 'request_cost':
        return this.getAverageRequestCost();
      case 'queue_size':
        return this.getTotalQueueSize();
      default:
        return 0;
    }
  }

  /**
   * Get total daily cost across all providers
   */
  private getDailyCost(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.costTrackers
      .filter(tracker => tracker.timestamp >= today)
      .reduce((sum, tracker) => sum + tracker.cost, 0);
  }

  /**
   * Get total hourly cost across all providers
   */
  private getHourlyCost(): number {
    const oneHourAgo = new Date(Date.now() - 3600000);

    return this.costTrackers
      .filter(tracker => tracker.timestamp >= oneHourAgo)
      .reduce((sum, tracker) => sum + tracker.cost, 0);
  }

  /**
   * Get average cost per request
   */
  private getAverageRequestCost(): number {
    if (this.costTrackers.length === 0) return 0;

    const totalCost = this.costTrackers.reduce((sum, tracker) => sum + tracker.cost, 0);
    return totalCost / this.costTrackers.length;
  }

  /**
   * Get total size of all request queues
   */
  private getTotalQueueSize(): number {
    return Array.from(this.requestQueues.values())
      .reduce((sum, queue) => sum + queue.requests.length, 0);
  }

  /**
   * Check rate limits for a provider/model combination
   */
  private async checkRateLimits(provider: string, model: string): Promise<void> {
    const rule = this.getApplicableRateLimitRule(provider);
    if (!rule || !rule.enabled) {
      return;
    }

    const key = `${provider}:${model}`;
    const now = new Date();
    const counters = this.requestCounters.get(key) || { count: 0, window_start: now };

    // Reset counter if window has passed
    if (now.getTime() - counters.window_start.getTime() >= 60000) { // 1 minute window
      counters.count = 0;
      counters.window_start = now;
    }

    // Check rate limits
    if (counters.count >= rule.limits.requests_per_minute) {
      throw new Error(`Rate limit exceeded for ${provider}:${model}. Limit: ${rule.limits.requests_per_minute}/minute`);
    }

    counters.count++;
    this.requestCounters.set(key, counters);
  }

  /**
   * Get the applicable rate limit rule for a provider
   */
  private getApplicableRateLimitRule(provider: string): RateLimitRule | null {
    const rules = Array.from(this.rateLimitRules.values())
      .filter(rule => rule.provider === provider && rule.enabled)
      .sort((a, b) => b.priority - a.priority);

    return rules.length > 0 ? rules[0] : null;
  }

  /**
   * Queue a request for later processing
   */
  private async queueRequest<T>(
    operation: string,
    requestFn: () => Promise<T>,
    options: {
      provider: string;
      model: string;
      user_id?: string;
      priority: number;
      estimated_cost: number;
    }
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queueId = `${options.provider}:${options.model}`;
      const queue = this.requestQueues.get(queueId) || {
        id: queueId,
        requests: [],
        processing: false,
        max_concurrent: 3,
        rate_limit_window: 1000,
        total_cost: 0
      };

      const request = {
        id: this.generateRequestId(),
        operation,
        priority: options.priority,
        timestamp: new Date(),
        estimated_cost: options.estimated_cost,
        user_id: options.user_id,
        callback: resolve,
        error_callback: reject
      };

      queue.requests.push(request);
      queue.requests.sort((a, b) => b.priority - a.priority); // Higher priority first

      this.requestQueues.set(queueId, queue);

      // Start processing queue if not already processing
      if (!queue.processing) {
        this.processQueue(queueId);
      }
    });
  }

  /**
   * Process requests in a queue
   */
  private async processQueue(queueId: string): Promise<void> {
    const queue = this.requestQueues.get(queueId);
    if (!queue || queue.processing || queue.requests.length === 0) {
      return;
    }

    queue.processing = true;
    this.requestQueues.set(queueId, queue);

    while (queue.requests.length > 0) {
      const request = queue.requests.shift()!;
      const rule = this.getApplicableRateLimitRule(queueId.split(':')[0]);

      if (rule) {
        // Apply rate limiting delay
        const delay = (60000 / rule.limits.requests_per_minute) * 0.9; // 90% of limit interval
        await this.delay(Math.max(100, delay));
      }

      try {
        // Execute the request
        const result = await this.executeWithRateLimit(
          request.operation,
          async () => {
            // This is a placeholder - the original request function is not stored
            // In a real implementation, we'd need to store the original function
            throw new Error('Original request function not available in queue processing');
          },
          {
            provider: queueId.split(':')[0],
            model: queueId.split(':')[1],
            user_id: request.user_id,
            priority: request.priority,
            estimated_cost: request.estimated_cost,
            bypass_queue: true // Prevent infinite recursion
          }
        );

        request.callback(result);
      } catch (error) {
        request.error_callback(error as Error);
      }
    }

    queue.processing = false;
    this.requestQueues.set(queueId, queue);
  }

  /**
   * Track request for cost and usage monitoring
   */
  private trackRequest(tracker: CostTracker): void {
    this.costTrackers.push(tracker);

    // Keep only last 10000 trackers
    if (this.costTrackers.length > 10000) {
      this.costTrackers.splice(0, this.costTrackers.length - 10000);
    }

    // Update usage metrics
    this.updateUsageMetrics(tracker);
  }

  /**
   * Update usage metrics for a provider/model/operation
   */
  private updateUsageMetrics(tracker: CostTracker): void {
    const key = `${tracker.provider}:${tracker.model}:${tracker.operation}`;
    const metrics = this.usageMetrics.get(key) || [];

    const lastMetric = metrics[metrics.length - 1];
    const now = new Date();

    if (!lastMetric || (now.getTime() - lastMetric.timestamp.getTime()) > 300000) { // 5 minutes
      // Create new metric entry
      const newMetric: UsageMetrics = {
        timestamp: now,
        provider: tracker.provider,
        model: tracker.model,
        operation: tracker.operation,
        request_count: 1,
        total_cost: tracker.cost,
        avg_latency: tracker.metadata?.latency || 0,
        error_count: tracker.metadata?.success === false ? 1 : 0,
        cache_hits: 0,
        cache_misses: 1
      };

      metrics.push(newMetric);
    } else {
      // Update existing metric
      lastMetric.request_count++;
      lastMetric.total_cost += tracker.cost;
      lastMetric.avg_latency = (lastMetric.avg_latency + (tracker.metadata?.latency || 0)) / 2;
      if (tracker.metadata?.success === false) {
        lastMetric.error_count++;
      }
    }

    // Keep only last 1000 metrics per key
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000);
    }

    this.usageMetrics.set(key, metrics);
  }

  /**
   * Start cost optimization monitoring
   */
  private startCostOptimization(): void {
    this.costOptimizationInterval = setInterval(() => {
      this.evaluateCostOptimizationRules();
    }, 60000); // Check every minute
  }

  /**
   * Evaluate and apply cost optimization rules
   */
  private evaluateCostOptimizationRules(): void {
    const rules = Array.from(this.costOptimizationRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of rules) {
      if (this.evaluateCostRule(rule)) {
        this.applyCostOptimizationActions(rule);
      }
    }
  }

  /**
   * Apply cost optimization actions
   */
  private applyCostOptimizationActions(rule: CostOptimizationRule): void {
    for (const action of rule.actions) {
      switch (action.type) {
        case 'switch_provider':
          this.switchToCostEffectiveProvider(action);
          break;
        case 'reduce_batch_size':
          this.reduceBatchSizes(action);
          break;
        case 'enable_caching':
          this.enableRequestCaching(action);
          break;
        case 'throttle_requests':
          this.throttleRequestRate(action);
          break;
        case 'queue_requests':
          this.enableRequestQueueing(action);
          break;
      }
    }
  }

  /**
   * Switch to more cost-effective provider
   */
  private switchToCostEffectiveProvider(action: any): void {
    console.log('Switching to cost-effective provider:', action.config);
  }

  /**
   * Reduce batch sizes to lower costs
   */
  private reduceBatchSizes(action: any): void {
    console.log('Reducing batch sizes:', action.config);
  }

  /**
   * Enable request caching
   */
  private enableRequestCaching(action: any): void {
    console.log('Enabling request caching:', action.config);
  }

  /**
   * Throttle request rate
   */
  private throttleRequestRate(action: any): void {
    console.log('Throttling request rate:', action.config);
  }

  /**
   * Enable request queueing
   */
  private enableRequestQueueing(action: any): void {
    console.log('Enabling request queueing:', action.config);
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
   * Collect and aggregate metrics
   */
  private collectAndAggregateMetrics(): void {
    // This would aggregate metrics and store them for reporting
    const totalCost = this.getDailyCost();
    const totalRequests = this.costTrackers.length;
    const errorRate = this.costTrackers.filter(t => t.metadata?.success === false).length / totalRequests;

    console.log(`Daily Metrics - Cost: $${totalCost.toFixed(2)}, Requests: ${totalRequests}, Error Rate: ${(errorRate * 100).toFixed(1)}%`);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cost and usage report
   */
  getCostReport(timeRange: { start: Date; end: Date } = {
    start: new Date(Date.now() - 24 * 3600000), // Last 24 hours
    end: new Date()
  }): {
    total_cost: number;
    total_requests: number;
    cost_by_provider: Record<string, number>;
    cost_by_operation: Record<string, number>;
    usage_by_provider: Record<string, number>;
    error_rate: number;
    recommendations: string[];
  } {
    const trackersInRange = this.costTrackers.filter(
      tracker => tracker.timestamp >= timeRange.start && tracker.timestamp <= timeRange.end
    );

    const total_cost = trackersInRange.reduce((sum, tracker) => sum + tracker.cost, 0);
    const total_requests = trackersInRange.length;
    const error_count = trackersInRange.filter(t => t.metadata?.success === false).length;
    const error_rate = total_requests > 0 ? error_count / total_requests : 0;

    const cost_by_provider = trackersInRange.reduce((acc, tracker) => {
      acc[tracker.provider] = (acc[tracker.provider] || 0) + tracker.cost;
      return acc;
    }, {} as Record<string, number>);

    const cost_by_operation = trackersInRange.reduce((acc, tracker) => {
      acc[tracker.operation] = (acc[tracker.operation] || 0) + tracker.cost;
      return acc;
    }, {} as Record<string, number>);

    const usage_by_provider = trackersInRange.reduce((acc, tracker) => {
      acc[tracker.provider] = (acc[tracker.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const recommendations = this.generateCostRecommendations(total_cost, cost_by_provider, error_rate);

    return {
      total_cost,
      total_requests,
      cost_by_provider,
      cost_by_operation,
      usage_by_provider,
      error_rate,
      recommendations
    };
  }

  /**
   * Generate cost optimization recommendations
   */
  private generateCostRecommendations(
    total_cost: number,
    cost_by_provider: Record<string, number>,
    error_rate: number
  ): string[] {
    const recommendations: string[] = [];

    if (total_cost > 100) {
      recommendations.push('Consider implementing more aggressive caching to reduce API calls');
    }

    if (error_rate > 0.05) {
      recommendations.push('High error rate detected. Consider switching to more reliable providers');
    }

    const mostExpensiveProvider = Object.entries(cost_by_provider)
      .sort(([,a], [,b]) => b - a)[0];

    if (mostExpensiveProvider && mostExpensiveProvider[1] > total_cost * 0.5) {
      recommendations.push(`Provider ${mostExpensiveProvider[0]} accounts for ${((mostExpensiveProvider[1]/total_cost) * 100).toFixed(1)}% of costs. Consider cost optimization.`);
    }

    return recommendations;
  }

  /**
   * Get rate limit status for all providers
   */
  getRateLimitStatus(): Record<string, {
    current_usage: number;
    limit: number;
    window_start: Date;
    status: 'ok' | 'warning' | 'critical';
  }> {
    const status: Record<string, any> = {};

    for (const [key, counters] of this.requestCounters.entries()) {
      const [provider, model] = key.split(':');
      const rule = this.getApplicableRateLimitRule(provider);

      if (rule) {
        const usage_percentage = (counters.count / rule.limits.requests_per_minute) * 100;
        let status_level: 'ok' | 'warning' | 'critical' = 'ok';

        if (usage_percentage > 90) {
          status_level = 'critical';
        } else if (usage_percentage > 70) {
          status_level = 'warning';
        }

        status[key] = {
          current_usage: counters.count,
          limit: rule.limits.requests_per_minute,
          window_start: counters.window_start,
          status: status_level
        };
      }
    }

    return status;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.costOptimizationInterval) {
      clearInterval(this.costOptimizationInterval);
      this.costOptimizationInterval = null;
    }

    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }

  /**
   * Get all rate limit rules
   */
  getAllRateLimitRules(): RateLimitRule[] {
    return Array.from(this.rateLimitRules.values());
  }

  /**
   * Get all cost optimization rules
   */
  getAllCostOptimizationRules(): CostOptimizationRule[] {
    return Array.from(this.costOptimizationRules.values());
  }

  /**
   * Update rate limit rule
   */
  updateRateLimitRule(ruleId: string, updates: Partial<RateLimitRule>): void {
    const rule = this.rateLimitRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
    }
  }

  /**
   * Update cost optimization rule
   */
  updateCostOptimizationRule(ruleId: string, updates: Partial<CostOptimizationRule>): void {
    const rule = this.costOptimizationRules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
    }
  }

  /**
   * Enable or disable rate limiting for a provider
   */
  setRateLimitingEnabled(provider: string, enabled: boolean): void {
    const rules = Array.from(this.rateLimitRules.values())
      .filter(rule => rule.provider === provider);

    for (const rule of rules) {
      rule.enabled = enabled;
    }
  }

  /**
   * Enable or disable cost optimization
   */
  setCostOptimizationEnabled(enabled: boolean): void {
    const rules = Array.from(this.costOptimizationRules.values());

    for (const rule of rules) {
      rule.enabled = enabled;
    }
  }

  /**
   * Get queue status for all providers
   */
  getQueueStatus(): Record<string, {
    queue_size: number;
    processing: boolean;
    estimated_wait_time: number;
    total_cost_pending: number;
  }> {
    const status: Record<string, any> = {};

    for (const [queueId, queue] of this.requestQueues.entries()) {
      const avg_processing_time = 5000; // 5 seconds average
      const estimated_wait_time = (queue.requests.length * avg_processing_time) / 1000; // in seconds

      status[queueId] = {
        queue_size: queue.requests.length,
        processing: queue.processing,
        estimated_wait_time,
        total_cost_pending: queue.requests.reduce((sum, req) => sum + req.estimated_cost, 0)
      };
    }

    return status;
  }

  /**
   * Force process a specific queue
   */
  async forceProcessQueue(provider: string, model: string): Promise<void> {
    const queueId = `${provider}:${model}`;
    await this.processQueue(queueId);
  }

  /**
   * Clear all queues (emergency use)
   */
  clearAllQueues(): void {
    for (const [queueId, queue] of this.requestQueues.entries()) {
      // Reject all pending requests
      for (const request of queue.requests) {
        request.error_callback(new Error('Queue cleared by administrator'));
      }

      queue.requests = [];
      queue.processing = false;
      this.requestQueues.set(queueId, queue);
    }
  }

  /**
   * Get real-time cost dashboard data
   */
  getCostDashboard(): {
    current_hour_cost: number;
    current_day_cost: number;
    projected_monthly_cost: number;
    top_cost_drivers: Array<{ provider: string; cost: number; percentage: number }>;
    rate_limit_alerts: Array<{ provider: string; severity: 'warning' | 'critical'; message: string }>;
    optimization_opportunities: string[];
  } {
    const current_hour_cost = this.getHourlyCost();
    const current_day_cost = this.getDailyCost();
    const projected_monthly_cost = current_day_cost * 30;

    const cost_by_provider = this.costTrackers
      .filter(t => t.timestamp >= new Date(Date.now() - 3600000)) // Last hour
      .reduce((acc, tracker) => {
        acc[tracker.provider] = (acc[tracker.provider] || 0) + tracker.cost;
        return acc;
      }, {} as Record<string, number>);

    const top_cost_drivers = Object.entries(cost_by_provider)
      .map(([provider, cost]) => ({
        provider,
        cost,
        percentage: (cost / current_hour_cost) * 100
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);

    const rate_limit_alerts = this.generateRateLimitAlerts();
    const optimization_opportunities = this.identifyOptimizationOpportunities();

    return {
      current_hour_cost,
      current_day_cost,
      projected_monthly_cost,
      top_cost_drivers,
      rate_limit_alerts,
      optimization_opportunities
    };
  }

  /**
   * Generate rate limit alerts
   */
  private generateRateLimitAlerts(): Array<{ provider: string; severity: 'warning' | 'critical'; message: string }> {
    const alerts: Array<{ provider: string; severity: 'warning' | 'critical'; message: string }> = [];

    for (const [key, counters] of this.requestCounters.entries()) {
      const [provider] = key.split(':');
      const rule = this.getApplicableRateLimitRule(provider);

      if (rule) {
        const usage_percentage = (counters.count / rule.limits.requests_per_minute) * 100;

        if (usage_percentage > 90) {
          alerts.push({
            provider,
            severity: 'critical',
            message: `Rate limit at ${usage_percentage.toFixed(1)}% for ${provider}`
          });
        } else if (usage_percentage > 70) {
          alerts.push({
            provider,
            severity: 'warning',
            message: `Rate limit at ${usage_percentage.toFixed(1)}% for ${provider}`
          });
        }
      }
    }

    return alerts;
  }

  /**
   * Identify optimization opportunities
   */
  private identifyOptimizationOpportunities(): string[] {
    const opportunities: string[] = [];

    const hourly_cost = this.getHourlyCost();
    if (hourly_cost > 5) {
      opportunities.push('Consider implementing request batching to reduce API calls');
    }

    const error_rate = this.costTrackers.filter(t => t.metadata?.success === false).length / this.costTrackers.length;
    if (error_rate > 0.1) {
      opportunities.push('High error rate suggests need for better fallback strategies');
    }

    const queue_size = this.getTotalQueueSize();
    if (queue_size > 20) {
      opportunities.push('Large queue size indicates need for capacity planning');
    }

    return opportunities;
  }
}