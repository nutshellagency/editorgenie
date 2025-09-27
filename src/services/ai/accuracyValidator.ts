import { ModelVersionManager, ModelVersion } from './modelVersionManager';
import { RateLimitManager } from './rateLimitManager';

export interface ValidationTestCase {
  id: string;
  name: string;
  description: string;
  input: any;
  expected_output: any;
  validation_criteria: {
    accuracy_threshold: number;
    confidence_threshold?: number;
    consistency_threshold?: number;
    performance_threshold?: number;
  };
  metadata: {
    category: 'transcription' | 'vision' | 'text_analysis' | 'emotion' | 'general';
    difficulty: 'easy' | 'medium' | 'hard';
    tags: string[];
    created_by: string;
    created_at: Date;
  };
}

export interface ValidationResult {
  test_case_id: string;
  model_id: string;
  timestamp: Date;
  input: any;
  expected_output: any;
  actual_output: any;
  metrics: {
    accuracy: number;
    confidence: number;
    consistency: number;
    performance: {
      latency: number;
      throughput: number;
      memory_usage: number;
    };
    quality: {
      completeness: number;
      correctness: number;
      clarity: number;
      relevance: number;
    };
  };
  passed: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface QualityMetrics {
  model_id: string;
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  overall_score: number;
  accuracy: {
    average: number;
    p95: number;
    p99: number;
    trend: 'improving' | 'stable' | 'declining';
  };
  consistency: {
    intra_model: number;
    inter_model: number;
    temporal: number;
  };
  performance: {
    average_latency: number;
    throughput: number;
    error_rate: number;
    uptime: number;
  };
  quality: {
    completeness: number;
    correctness: number;
    clarity: number;
    relevance: number;
  };
  benchmarks: {
    against_baseline: number;
    against_competitors: number;
    industry_comparison: number;
  };
}

export interface AccuracyBenchmark {
  id: string;
  name: string;
  description: string;
  dataset: {
    name: string;
    size: number;
    source: string;
    last_updated: Date;
  };
  metrics: {
    baseline_accuracy: number;
    current_accuracy: number;
    improvement: number;
    confidence_interval: {
      lower: number;
      upper: number;
    };
  };
  leaderboard: Array<{
    model_name: string;
    accuracy: number;
    rank: number;
    last_evaluated: Date;
  }>;
}

export interface ValidationSuite {
  id: string;
  name: string;
  description: string;
  test_cases: ValidationTestCase[];
  schedule: {
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    enabled: boolean;
    last_run: Date;
    next_run: Date;
  };
  models: string[]; // Model IDs to test
  criteria: {
    min_pass_rate: number;
    max_execution_time: number;
    required_confidence: number;
  };
}

export class AccuracyValidator {
  private modelManager: ModelVersionManager;
  private rateLimitManager: RateLimitManager;
  private testCases: Map<string, ValidationTestCase> = new Map();
  private validationResults: ValidationResult[] = [];
  private qualityMetrics: Map<string, QualityMetrics[]> = new Map();
  private benchmarks: Map<string, AccuracyBenchmark> = new Map();
  private validationSuites: Map<string, ValidationSuite> = new Map();
  private validationInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(modelManager: ModelVersionManager, rateLimitManager: RateLimitManager) {
    this.modelManager = modelManager;
    this.rateLimitManager = rateLimitManager;
    this.initializeDefaultTestCases();
    this.initializeDefaultBenchmarks();
    this.startAutomatedValidation();
    this.startMetricsCollection();
  }

  /**
   * Initialize default validation test cases
   */
  private initializeDefaultTestCases(): void {
    // Transcription test cases
    this.registerTestCase({
      id: 'transcription-basic',
      name: 'Basic Transcription Test',
      description: 'Test basic speech-to-text accuracy',
      input: Buffer.from('sample-audio-basic'),
      expected_output: {
        text: 'This is a test of the transcription system.',
        confidence: 0.95,
        language: 'en'
      },
      validation_criteria: {
        accuracy_threshold: 0.9,
        confidence_threshold: 0.85
      },
      metadata: {
        category: 'transcription',
        difficulty: 'easy',
        tags: ['speech-to-text', 'basic', 'english'],
        created_by: 'system',
        created_at: new Date()
      }
    });

    this.registerTestCase({
      id: 'transcription-accent',
      name: 'Accented Speech Test',
      description: 'Test transcription accuracy with various accents',
      input: Buffer.from('sample-audio-accent'),
      expected_output: {
        text: 'The quick brown fox jumps over the lazy dog.',
        confidence: 0.85,
        language: 'en',
        accent: 'british'
      },
      validation_criteria: {
        accuracy_threshold: 0.8,
        confidence_threshold: 0.75
      },
      metadata: {
        category: 'transcription',
        difficulty: 'medium',
        tags: ['speech-to-text', 'accents', 'english'],
        created_by: 'system',
        created_at: new Date()
      }
    });

    // Vision test cases
    this.registerTestCase({
      id: 'vision-object-detection',
      name: 'Object Detection Test',
      description: 'Test object detection accuracy',
      input: Buffer.from('sample-image-objects'),
      expected_output: {
        objects: [
          { label: 'person', confidence: 0.95, bounding_box: { x: 100, y: 50, width: 200, height: 300 } },
          { label: 'car', confidence: 0.90, bounding_box: { x: 300, y: 100, width: 150, height: 80 } }
        ]
      },
      validation_criteria: {
        accuracy_threshold: 0.85,
        confidence_threshold: 0.8
      },
      metadata: {
        category: 'vision',
        difficulty: 'medium',
        tags: ['object-detection', 'computer-vision'],
        created_by: 'system',
        created_at: new Date()
      }
    });

    // Text analysis test cases
    this.registerTestCase({
      id: 'text-sentiment-analysis',
      name: 'Sentiment Analysis Test',
      description: 'Test sentiment analysis accuracy',
      input: 'I love this amazing product! It works perfectly and exceeds all expectations.',
      expected_output: {
        sentiment: 'positive',
        confidence: 0.95,
        emotions: ['joy', 'satisfaction', 'excitement']
      },
      validation_criteria: {
        accuracy_threshold: 0.9,
        confidence_threshold: 0.85
      },
      metadata: {
        category: 'text_analysis',
        difficulty: 'easy',
        tags: ['sentiment', 'nlp', 'positive'],
        created_by: 'system',
        created_at: new Date()
      }
    });

    // Emotion detection test cases
    this.registerTestCase({
      id: 'emotion-facial-recognition',
      name: 'Facial Emotion Recognition Test',
      description: 'Test facial emotion detection accuracy',
      input: Buffer.from('sample-image-happy-face'),
      expected_output: {
        emotions: [
          { emotion: 'happiness', confidence: 0.90, intensity: 'high' },
          { emotion: 'surprise', confidence: 0.10, intensity: 'low' }
        ]
      },
      validation_criteria: {
        accuracy_threshold: 0.85,
        confidence_threshold: 0.8
      },
      metadata: {
        category: 'emotion',
        difficulty: 'medium',
        tags: ['facial-recognition', 'emotion', 'happiness'],
        created_by: 'system',
        created_at: new Date()
      }
    });
  }

  /**
   * Initialize default benchmarks
   */
  private initializeDefaultBenchmarks(): void {
    this.registerBenchmark({
      id: 'transcription-benchmark',
      name: 'Speech-to-Text Benchmark',
      description: 'Industry standard transcription accuracy benchmark',
      dataset: {
        name: 'LibriSpeech Test Set',
        size: 1000,
        source: 'OpenSLR',
        last_updated: new Date()
      },
      metrics: {
        baseline_accuracy: 0.95,
        current_accuracy: 0.94,
        improvement: -0.01,
        confidence_interval: {
          lower: 0.93,
          upper: 0.95
        }
      },
      leaderboard: [
        { model_name: 'AssemblyAI v2', accuracy: 0.94, rank: 1, last_evaluated: new Date() },
        { model_name: 'Google Speech-to-Text', accuracy: 0.93, rank: 2, last_evaluated: new Date() },
        { model_name: 'Azure Speech Services', accuracy: 0.92, rank: 3, last_evaluated: new Date() }
      ]
    });

    this.registerBenchmark({
      id: 'vision-benchmark',
      name: 'Computer Vision Benchmark',
      description: 'COCO dataset object detection benchmark',
      dataset: {
        name: 'COCO 2017 Validation',
        size: 5000,
        source: 'COCO Consortium',
        last_updated: new Date()
      },
      metrics: {
        baseline_accuracy: 0.85,
        current_accuracy: 0.87,
        improvement: 0.02,
        confidence_interval: {
          lower: 0.86,
          upper: 0.88
        }
      },
      leaderboard: [
        { model_name: 'Qwen Vision v1', accuracy: 0.87, rank: 1, last_evaluated: new Date() },
        { model_name: 'Google Vision AI', accuracy: 0.85, rank: 2, last_evaluated: new Date() },
        { model_name: 'Azure Computer Vision', accuracy: 0.84, rank: 3, last_evaluated: new Date() }
      ]
    });
  }

  /**
   * Register a validation test case
   */
  registerTestCase(testCase: ValidationTestCase): void {
    this.testCases.set(testCase.id, testCase);
  }

  /**
   * Register a benchmark
   */
  registerBenchmark(benchmark: AccuracyBenchmark): void {
    this.benchmarks.set(benchmark.id, benchmark);
  }

  /**
   * Register a validation suite
   */
  registerValidationSuite(suite: ValidationSuite): void {
    this.validationSuites.set(suite.id, suite);
  }

  /**
   * Validate a model against a test case
   */
  async validateModel(
    modelId: string,
    testCaseId: string,
    options: {
      save_results?: boolean;
      generate_report?: boolean;
    } = { save_results: true, generate_report: false }
  ): Promise<ValidationResult> {
    const model = this.modelManager.getModelVersion(modelId);
    const testCase = this.testCases.get(testCaseId);

    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    if (!testCase) {
      throw new Error(`Test case ${testCaseId} not found`);
    }

    const startTime = Date.now();
    let actual_output: any;
    let errors: string[] = [];
    let warnings: string[] = [];

    try {
      // Execute the model with the test input
      actual_output = await this.executeModelWithInput(model, testCase.input, testCase.metadata.category);
    } catch (error) {
      errors.push(`Model execution failed: ${(error as Error).message}`);
      actual_output = null;
    }

    const latency = Date.now() - startTime;

    // Calculate validation metrics
    const metrics = await this.calculateValidationMetrics(testCase, actual_output, latency);

    // Determine if test passed
    const passed = this.evaluateTestResults(metrics, testCase.validation_criteria);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics, testCase, model);

    const result: ValidationResult = {
      test_case_id: testCaseId,
      model_id: modelId,
      timestamp: new Date(),
      input: testCase.input,
      expected_output: testCase.expected_output,
      actual_output,
      metrics,
      passed,
      errors,
      warnings,
      recommendations
    };

    if (options.save_results) {
      this.saveValidationResult(result);
    }

    if (options.generate_report) {
      await this.generateValidationReport(result);
    }

    return result;
  }

  /**
   * Execute model with given input based on category
   */
  private async executeModelWithInput(model: ModelVersion, input: any, category: string): Promise<any> {
    // This would integrate with the actual AI services
    // For now, return mock results based on category
    switch (category) {
      case 'transcription':
        return {
          text: 'This is a test transcription result.',
          confidence: 0.92,
          language: 'en'
        };
      case 'vision':
        return {
          objects: [
            { label: 'person', confidence: 0.95, bounding_box: { x: 100, y: 50, width: 200, height: 300 } }
          ]
        };
      case 'text_analysis':
        return {
          sentiment: 'positive',
          confidence: 0.90,
          emotions: ['joy', 'satisfaction']
        };
      case 'emotion':
        return {
          emotions: [
            { emotion: 'happiness', confidence: 0.88, intensity: 'high' }
          ]
        };
      default:
        return { result: 'Mock result for unknown category' };
    }
  }

  /**
   * Calculate comprehensive validation metrics
   */
  private async calculateValidationMetrics(
    testCase: ValidationTestCase,
    actual_output: any,
    latency: number
  ): Promise<ValidationResult['metrics']> {
    // Calculate accuracy based on category
    const accuracy = this.calculateAccuracy(testCase.expected_output, actual_output, testCase.metadata.category);

    // Calculate confidence (mock for now)
    const confidence = actual_output?.confidence || 0.8;

    // Calculate consistency (would compare with previous runs)
    const consistency = await this.calculateConsistency(testCase.id, actual_output);

    // Performance metrics
    const performance = {
      latency,
      throughput: 1000 / latency, // requests per second
      memory_usage: Math.random() * 100 // Mock memory usage
    };

    // Quality metrics
    const quality = await this.calculateQualityMetrics(testCase, actual_output);

    return {
      accuracy,
      confidence,
      consistency,
      performance,
      quality
    };
  }

  /**
   * Calculate accuracy based on output type and category
   */
  private calculateAccuracy(expected: any, actual: any, category: string): number {
    if (!actual) return 0;

    switch (category) {
      case 'transcription':
        return this.calculateTextAccuracy(expected.text, actual.text);
      case 'vision':
        return this.calculateObjectDetectionAccuracy(expected.objects, actual.objects);
      case 'text_analysis':
        return this.calculateSentimentAccuracy(expected.sentiment, actual.sentiment);
      case 'emotion':
        return this.calculateEmotionAccuracy(expected.emotions, actual.emotions);
      default:
        return 0.5; // Default accuracy
    }
  }

  /**
   * Calculate text accuracy using Levenshtein distance
   */
  private calculateTextAccuracy(expected: string, actual: string): number {
    if (!expected || !actual) return 0;

    const distance = this.levenshteinDistance(expected.toLowerCase(), actual.toLowerCase());
    const maxLength = Math.max(expected.length, actual.length);

    return Math.max(0, 1 - (distance / maxLength));
  }

  /**
   * Calculate object detection accuracy
   */
  private calculateObjectDetectionAccuracy(expected: any[], actual: any[]): number {
    if (!expected || !actual) return 0;

    let totalAccuracy = 0;
    let matchCount = 0;

    for (const expectedObj of expected) {
      const matches = actual.filter((actualObj: any) =>
        actualObj.label === expectedObj.label &&
        Math.abs(actualObj.confidence - expectedObj.confidence) < 0.1
      );

      if (matches.length > 0) {
        totalAccuracy += matches[0].confidence;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalAccuracy / matchCount : 0;
  }

  /**
   * Calculate sentiment analysis accuracy
   */
  private calculateSentimentAccuracy(expected: string, actual: string): number {
    return expected === actual ? 1 : 0;
  }

  /**
   * Calculate emotion detection accuracy
   */
  private calculateEmotionAccuracy(expected: any[], actual: any[]): number {
    if (!expected || !actual) return 0;

    let totalAccuracy = 0;
    let matchCount = 0;

    for (const expectedEmotion of expected) {
      const matches = actual.filter((actualEmotion: any) =>
        actualEmotion.emotion === expectedEmotion.emotion &&
        Math.abs(actualEmotion.confidence - expectedEmotion.confidence) < 0.15
      );

      if (matches.length > 0) {
        totalAccuracy += matches[0].confidence;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalAccuracy / matchCount : 0;
  }

  /**
   * Calculate consistency score based on previous runs
   */
  private async calculateConsistency(testCaseId: string, currentOutput: any): Promise<number> {
    const previousResults = this.validationResults
      .filter(result => result.test_case_id === testCaseId)
      .slice(-10); // Last 10 results

    if (previousResults.length < 2) return 1; // Perfect consistency if no history

    let consistencySum = 0;

    for (const previousResult of previousResults) {
      const similarity = this.calculateOutputSimilarity(currentOutput, previousResult.actual_output);
      consistencySum += similarity;
    }

    return consistencySum / previousResults.length;
  }

  /**
   * Calculate similarity between two outputs
   */
  private calculateOutputSimilarity(output1: any, output2: any): number {
    if (!output1 || !output2) return 0;

    // Simple similarity based on JSON string comparison
    const str1 = JSON.stringify(output1);
    const str2 = JSON.stringify(output2);

    return this.calculateTextAccuracy(str1, str2);
  }

  /**
   * Calculate quality metrics
   */
  private async calculateQualityMetrics(testCase: ValidationTestCase, actual_output: any): Promise<ValidationResult['metrics']['quality']> {
    return {
      completeness: this.calculateCompleteness(actual_output),
      correctness: this.calculateCorrectness(testCase.expected_output, actual_output),
      clarity: this.calculateClarity(actual_output),
      relevance: this.calculateRelevance(testCase, actual_output)
    };
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(output: any): number {
    if (!output) return 0;

    // Count non-null fields
    const fields = Object.values(output);
    const nonNullFields = fields.filter(field => field !== null && field !== undefined);

    return nonNullFields.length / fields.length;
  }

  /**
   * Calculate correctness score
   */
  private calculateCorrectness(expected: any, actual: any): number {
    if (!expected || !actual) return 0;

    const accuracy = this.calculateAccuracy(expected, actual, 'general');
    return accuracy;
  }

  /**
   * Calculate clarity score
   */
  private calculateClarity(output: any): number {
    if (!output) return 0;

    // Simple heuristic based on confidence scores
    const confidences = this.extractConfidenceScores(output);
    return confidences.length > 0 ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length : 0.5;
  }

  /**
   * Calculate relevance score
   */
  private calculateRelevance(testCase: ValidationTestCase, output: any): number {
    // Simple relevance based on category matching
    return 0.8; // Mock relevance score
  }

  /**
   * Extract confidence scores from output
   */
  private extractConfidenceScores(output: any): number[] {
    const confidences: number[] = [];

    const extractFromObject = (obj: any) => {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.confidence !== undefined) {
          confidences.push(obj.confidence);
        }
        Object.values(obj).forEach(value => extractFromObject(value));
      }
    };

    extractFromObject(output);
    return confidences;
  }

  /**
   * Evaluate if test results meet criteria
   */
  private evaluateTestResults(
    metrics: ValidationResult['metrics'],
    criteria: ValidationTestCase['validation_criteria']
  ): boolean {
    if (metrics.accuracy < criteria.accuracy_threshold) {
      return false;
    }

    if (criteria.confidence_threshold && metrics.confidence < criteria.confidence_threshold) {
      return false;
    }

    if (criteria.consistency_threshold && metrics.consistency < criteria.consistency_threshold) {
      return false;
    }

    if (criteria.performance_threshold && metrics.performance.latency > criteria.performance_threshold) {
      return false;
    }

    return true;
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(
    metrics: ValidationResult['metrics'],
    testCase: ValidationTestCase,
    model: ModelVersion
  ): string[] {
    const recommendations: string[] = [];

    if (metrics.accuracy < 0.8) {
      recommendations.push('Model accuracy is below acceptable threshold. Consider retraining or fine-tuning.');
    }

    if (metrics.performance.latency > 5000) {
      recommendations.push('Model latency is high. Consider optimization or using a faster model variant.');
    }

    if (metrics.consistency < 0.7) {
      recommendations.push('Model consistency is low. Investigate sources of variability.');
    }

    if (metrics.quality.completeness < 0.8) {
      recommendations.push('Model output completeness is low. Check for missing data handling.');
    }

    return recommendations;
  }

  /**
   * Save validation result
   */
  private saveValidationResult(result: ValidationResult): void {
    this.validationResults.push(result);

    // Keep only last 10000 results
    if (this.validationResults.length > 10000) {
      this.validationResults.splice(0, this.validationResults.length - 10000);
    }
  }

  /**
   * Generate validation report
   */
  private async generateValidationReport(result: ValidationResult): Promise<void> {
    // This would generate a detailed PDF or HTML report
    console.log('Generating validation report for:', result.test_case_id);
  }

  /**
   * Start automated validation
   */
  private startAutomatedValidation(): void {
    this.validationInterval = setInterval(async () => {
      await this.runAutomatedValidation();
    }, 3600000); // Run every hour
  }

  /**
   * Run automated validation for all active models
   */
  private async runAutomatedValidation(): Promise<void> {
    const activeModels = this.modelManager.getAllModelVersions()
      .filter(model => model.status === 'active');

    const testCases = Array.from(this.testCases.values());

    for (const model of activeModels) {
      for (const testCase of testCases) {
        // Only run tests relevant to model capabilities
        if (model.capabilities.includes(testCase.metadata.category)) {
          try {
            await this.validateModel(model.id, testCase.id);
          } catch (error) {
            console.error(`Validation failed for model ${model.id} on test ${testCase.id}:`, error);
          }
        }
      }
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      this.collectQualityMetrics();
    }, 300000); // Collect every 5 minutes
  }

  /**
   * Collect and aggregate quality metrics
   */
  private collectQualityMetrics(): void {
    const modelIds = this.modelManager.getAllModelVersions()
      .filter(model => model.status === 'active')
      .map(model => model.id);

    for (const modelId of modelIds) {
      const metrics = this.calculateQualityMetricsForModel(modelId);
      this.storeQualityMetrics(modelId, metrics);
    }
  }

  /**
   * Calculate comprehensive quality metrics for a model
   */
  private calculateQualityMetricsForModel(modelId: string): QualityMetrics {
    const recentResults = this.validationResults
      .filter(result => result.model_id === modelId)
      .slice(-100); // Last 100 results

    if (recentResults.length === 0) {
      return this.createEmptyQualityMetrics(modelId);
    }

    const now = new Date();
    const periodStart = new Date(now.getTime() - 86400000); // Last 24 hours

    const periodResults = recentResults.filter(result => result.timestamp >= periodStart);

    const accuracyScores = periodResults.map(r => r.metrics.accuracy);
    const consistencyScores = periodResults.map(r => r.metrics.consistency);
    const latencyValues = periodResults.map(r => r.metrics.performance.latency);

    const qualityMetrics: QualityMetrics = {
      model_id: modelId,
      timestamp: now,
      period: {
        start: periodStart,
        end: now
      },
      overall_score: this.calculateOverallScore(periodResults),
      accuracy: {
        average: this.average(accuracyScores),
        p95: this.percentile(accuracyScores, 0.95),
        p99: this.percentile(accuracyScores, 0.99),
        trend: this.calculateTrend(accuracyScores)
      },
      consistency: {
        intra_model: this.average(consistencyScores),
        inter_model: 0.85, // Would compare with other models
        temporal: this.calculateTemporalConsistency(recentResults)
      },
      performance: {
        average_latency: this.average(latencyValues),
        throughput: 1000 / this.average(latencyValues),
        error_rate: periodResults.filter(r => !r.passed).length / periodResults.length,
        uptime: 0.99 // Would calculate from actual uptime data
      },
      quality: {
        completeness: this.average(periodResults.map(r => r.metrics.quality.completeness)),
        correctness: this.average(periodResults.map(r => r.metrics.quality.correctness)),
        clarity: this.average(periodResults.map(r => r.metrics.quality.clarity)),
        relevance: this.average(periodResults.map(r => r.metrics.quality.relevance))
      },
      benchmarks: {
        against_baseline: this.compareToBaseline(modelId, accuracyScores),
        against_competitors: this.compareToCompetitors(modelId),
        industry_comparison: this.compareToIndustryStandard(modelId)
      }
    };

    return qualityMetrics;
  }

  /**
   * Calculate overall quality score
   */
  private calculateOverallScore(results: ValidationResult[]): number {
    if (results.length === 0) return 0;

    const weights = {
      accuracy: 0.4,
      consistency: 0.2,
      performance: 0.2,
      quality: 0.2
    };

    const avgAccuracy = results.reduce((sum, r) => sum + r.metrics.accuracy, 0) / results.length;
    const avgConsistency = results.reduce((sum, r) => sum + r.metrics.consistency, 0) / results.length;
    const avgPerformance = this.calculatePerformanceScore(results);
    const avgQuality = this.calculateQualityScore(results);

    return (avgAccuracy * weights.accuracy) +
           (avgConsistency * weights.consistency) +
           (avgPerformance * weights.performance) +
           (avgQuality * weights.quality);
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(results: ValidationResult[]): number {
    const latencies = results.map(r => r.metrics.performance.latency);
    const avgLatency = this.average(latencies);

    // Convert latency to score (lower is better)
    return Math.max(0, 1 - (avgLatency / 10000)); // Assume 10s is worst case
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(results: ValidationResult[]): number {
    const completeness = results.map(r => r.metrics.quality.completeness);
    const correctness = results.map(r => r.metrics.quality.correctness);

    return (this.average(completeness) + this.average(correctness)) / 2;
  }

  /**
   * Calculate trend (improving, stable, declining)
   */
  private calculateTrend(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 10) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = this.average(firstHalf);
    const secondAvg = this.average(secondHalf);

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.05) return 'improving';
    if (change < -0.05) return 'declining';
    return 'stable';
  }

  /**
   * Calculate temporal consistency
   */
  private calculateTemporalConsistency(results: ValidationResult[]): number {
    if (results.length < 2) return 1;

    let consistencySum = 0;
    let comparisonCount = 0;

    for (let i = 1; i < results.length; i++) {
      const similarity = this.calculateOutputSimilarity(
        results[i].actual_output,
        results[i - 1].actual_output
      );
      consistencySum += similarity;
      comparisonCount++;
    }

    return consistencySum / comparisonCount;
  }

  /**
   * Compare to baseline performance
   */
  private compareToBaseline(modelId: string, accuracyScores: number[]): number {
    const benchmark = Array.from(this.benchmarks.values())
      .find(b => b.leaderboard.some(m => m.model_name.includes(modelId.split('-')[0])));

    if (!benchmark) return 0.5;

    const currentAccuracy = this.average(accuracyScores);
    return currentAccuracy / benchmark.metrics.baseline_accuracy;
  }

  /**
   * Compare to competitors
   */
  private compareToCompetitors(modelId: string): number {
    const benchmark = Array.from(this.benchmarks.values())
      .find(b => b.leaderboard.some(m => m.model_name.includes(modelId.split('-')[0])));

    if (!benchmark) return 0.5;

    const modelRanking = benchmark.leaderboard.find(m => m.model_name.includes(modelId.split('-')[0]));
    if (!modelRanking) return 0.5;

    const topAccuracy = benchmark.leaderboard[0].accuracy;
    return modelRanking.accuracy / topAccuracy;
  }

  /**
   * Compare to industry standard
   */
  private compareToIndustryStandard(modelId: string): number {
    // Mock industry comparison
    return 0.85;
  }

  /**
   * Store quality metrics
   */
  private storeQualityMetrics(modelId: string, metrics: QualityMetrics): void {
    const modelMetrics = this.qualityMetrics.get(modelId) || [];
    modelMetrics.push(metrics);

    // Keep only last 1000 metrics
    if (modelMetrics.length > 1000) {
      modelMetrics.splice(0, modelMetrics.length - 1000);
    }

    this.qualityMetrics.set(modelId, modelMetrics);
  }

  /**
   * Create empty quality metrics for model with no data
   */
  private createEmptyQualityMetrics(modelId: string): QualityMetrics {
    const now = new Date();
    const periodStart = new Date(now.getTime() - 86400000);

    return {
      model_id: modelId,
      timestamp: now,
      period: { start: periodStart, end: now },
      overall_score: 0,
      accuracy: { average: 0, p95: 0, p99: 0, trend: 'stable' },
      consistency: { intra_model: 0, inter_model: 0, temporal: 0 },
      performance: { average_latency: 0, throughput: 0, error_rate: 1, uptime: 0 },
      quality: { completeness: 0, correctness: 0, clarity: 0, relevance: 0 },
      benchmarks: { against_baseline: 0, against_competitors: 0, industry_comparison: 0 }
    };
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate average of array
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate percentile of array
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;

    if (Number.isInteger(index)) {
      return sorted[index];
    }

    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    return sorted[lower] * (upper - index) + sorted[upper] * (index - lower);
  }

  /**
   * Get quality report for all models
   */
  getQualityReport(): {
    models: Array<{
      model: ModelVersion;
      metrics: QualityMetrics;
      status: 'excellent' | 'good' | 'fair' | 'poor';
      recommendations: string[];
    }>;
    benchmarks: AccuracyBenchmark[];
    summary: {
      total_models: number;
      active_validations: number;
      average_accuracy: number;
      top_performing_model: string;
    };
  } {
    const models = this.modelManager.getAllModelVersions()
      .filter(model => model.status === 'active')
      .map(model => {
        const metrics = this.qualityMetrics.get(model.id)?.slice(-1)[0] || this.createEmptyQualityMetrics(model.id);

        let status: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
        if (metrics.overall_score >= 0.9) status = 'excellent';
        else if (metrics.overall_score >= 0.8) status = 'good';
        else if (metrics.overall_score >= 0.7) status = 'fair';

        const recommendations = this.generateModelRecommendations(metrics);

        return { model, metrics, status, recommendations };
      });

    const benchmarks = Array.from(this.benchmarks.values());

    const summary = {
      total_models: models.length,
      active_validations: this.validationResults.length,
      average_accuracy: models.reduce((sum, m) => sum + m.metrics.accuracy.average, 0) / models.length,
      top_performing_model: models.reduce((best, current) =>
        current.metrics.overall_score > best.metrics.overall_score ? current : best
      ).model.model_name
    };

    return { models, benchmarks, summary };
  }

  /**
   * Generate recommendations for a model based on its metrics
   */
  private generateModelRecommendations(metrics: QualityMetrics): string[] {
    const recommendations: string[] = [];

    if (metrics.accuracy.average < 0.8) {
      recommendations.push('Consider model retraining or hyperparameter tuning');
    }

    if (metrics.performance.error_rate > 0.1) {
      recommendations.push('High error rate detected. Review model implementation');
    }

    if (metrics.performance.average_latency > 5000) {
      recommendations.push('Performance optimization needed for production use');
    }

    if (metrics.consistency.intra_model < 0.7) {
      recommendations.push('Model consistency issues detected. Investigate randomness sources');
    }

    return recommendations;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Get all test cases
   */
  getAllTestCases(): ValidationTestCase[] {
    return Array.from(this.testCases.values());
  }

  /**
   * Get all validation results
   */
  getAllValidationResults(): ValidationResult[] {
    return [...this.validationResults];
  }

  /**
   * Get validation results for a specific model
   */
  getValidationResultsForModel(modelId: string): ValidationResult[] {
    return this.validationResults.filter(result => result.model_id === modelId);
  }

  /**
   * Get quality metrics for a model
   */
  getQualityMetricsForModel(modelId: string): QualityMetrics[] {
    return this.qualityMetrics.get(modelId) || [];
  }

  /**
   * Get all benchmarks
   */
  getAllBenchmarks(): AccuracyBenchmark[] {
    return Array.from(this.benchmarks.values());
  }

  /**
   * Run validation suite
   */
  async runValidationSuite(suiteId: string): Promise<{
    suite: ValidationSuite;
    results: ValidationResult[];
    summary: {
      total_tests: number;
      passed_tests: number;
      failed_tests: number;
      pass_rate: number;
      execution_time: number;
    };
  }> {
    const suite = this.validationSuites.get(suiteId);
    if (!suite) {
      throw new Error(`Validation suite ${suiteId} not found`);
    }

    const startTime = Date.now();
    const results: ValidationResult[] = [];

    for (const testCase of suite.test_cases) {
      for (const modelId of suite.models) {
        try {
          const result = await this.validateModel(modelId, testCase.id);
          results.push(result);
        } catch (error) {
          console.error(`Validation failed for model ${modelId} on test ${testCase.id}:`, error);
        }
      }
    }

    const executionTime = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;

    const summary = {
      total_tests: results.length,
      passed_tests: passedTests,
      failed_tests: results.length - passedTests,
      pass_rate: results.length > 0 ? passedTests / results.length : 0,
      execution_time: executionTime
    };

    // Update suite schedule
    suite.schedule.last_run = new Date();
    suite.schedule.next_run = new Date(Date.now() + this.getNextRunInterval(suite.schedule.frequency));

    return { suite, results, summary };
  }

  /**
   * Get next run interval for frequency
   */
  private getNextRunInterval(frequency: string): number {
    switch (frequency) {
      case 'hourly': return 3600000;
      case 'daily': return 86400000;
      case 'weekly': return 604800000;
      case 'monthly': return 2592000000;
      default: return 86400000;
    }
  }
}