import { TextAnalysisService } from './textAnalysisService';
import { VisionService } from './visionService';
import { STTService } from './sttService';
import { AIService } from './aiService';

export interface ContentMetadata {
  id: string;
  type: 'text' | 'audio' | 'video' | 'image';
  language?: string;
  duration?: number;
  size?: number;
  quality: {
    clarity: number;
    completeness: number;
    consistency: number;
  };
  content: {
    topics: Array<{
      topic: string;
      confidence: number;
      relevance: number;
    }>;
    themes: Array<{
      theme: string;
      confidence: number;
      occurrences: number;
    }>;
    keywords: Array<{
      word: string;
      frequency: number;
      importance: number;
    }>;
    entities: Array<{
      entity: string;
      type: 'person' | 'organization' | 'location' | 'date' | 'other';
      confidence: number;
    }>;
  };
  structure: {
    format: 'presentation' | 'conversation' | 'documentary' | 'interview' | 'other';
    sections: Array<{
      title: string;
      start: number;
      end: number;
      type: 'introduction' | 'main' | 'conclusion' | 'transition';
    }>;
    key_points: string[];
  };
  sentiment: {
    overall: 'positive' | 'negative' | 'neutral';
    confidence: number;
    emotions: Array<{
      emotion: string;
      intensity: number;
      confidence: number;
    }>;
  };
  highlights: Array<{
    text: string;
    start: number;
    end: number;
    importance: number;
    type: 'key_point' | 'quote' | 'statistic' | 'conclusion';
  }>;
  summaries: {
    short: string;
    medium: string;
    long: string;
  };
  technical: {
    word_count?: number;
    sentence_count?: number;
    avg_sentence_length?: number;
    complexity_score: number;
    readability_score: number;
  };
}

export interface MultiModalAnalysis {
  text: ContentMetadata;
  audio?: {
    quality: number;
    clarity: number;
    speakers: Array<{
      id: string;
      segments: Array<{
        start: number;
        end: number;
        confidence: number;
      }>;
      characteristics: {
        gender?: 'male' | 'female' | 'unknown';
        age_group?: 'child' | 'young_adult' | 'adult' | 'senior';
        accent?: string;
      };
    }>;
    background_noise: number;
    music_presence: boolean;
  };
  visual?: {
    scenes: Array<{
      start: number;
      end: number;
      description: string;
      shot_type: 'close_up' | 'medium' | 'wide' | 'extreme_wide' | 'establishing';
      movement: 'static' | 'slow_pan' | 'fast_pan' | 'zoom_in' | 'zoom_out' | 'tracking';
      objects: Array<{
        label: string;
        confidence: number;
        bounding_box?: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
      faces: Array<{
        confidence: number;
        emotions?: Array<{
          emotion: string;
          confidence: number;
        }>;
        bounding_box?: {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      }>;
    }>;
    transitions: Array<{
      from_scene: number;
      to_scene: number;
      type: 'cut' | 'fade' | 'dissolve' | 'wipe';
      duration: number;
    }>;
    quality: {
      resolution: string;
      frame_rate: number;
      brightness: number;
      contrast: number;
      sharpness: number;
    };
  };
  correlation: {
    text_audio_alignment: number;
    text_visual_alignment: number;
    audio_visual_alignment: number;
    inconsistencies: Array<{
      type: 'timing' | 'content' | 'emotion' | 'context';
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

export class ContentAnalysisService {
  private textService: TextAnalysisService;
  private visionService: VisionService;
  private sttService: STTService;
  private aiService: AIService;

  constructor(
    textService: TextAnalysisService,
    visionService: VisionService,
    sttService: STTService,
    aiService: AIService
  ) {
    this.textService = textService;
    this.visionService = visionService;
    this.sttService = sttService;
    this.aiService = aiService;
  }

  /**
   * Analyze text content and extract comprehensive metadata
   */
  async analyzeTextContent(content: string): Promise<ContentMetadata> {
    const [
      narrativeAnalysis,
      contentClassification,
      highlights,
      sentimentAnalysis,
      qualityMetrics
    ] = await Promise.all([
      this.textService.analyzeNarrative(content),
      this.textService.classifyContent(content),
      this.textService.extractHighlights(content),
      this.textService.detectEmotions(content),
      this.assessTextQuality(content)
    ]);

    // Extract keywords and entities
    const keywords = await this.extractKeywords(content);
    const entities = await this.extractEntities(content);

    // Generate summaries
    const summaries = await this.generateSummaries(content);

    // Calculate technical metrics
    const technical = this.calculateTechnicalMetrics(content);

    return {
      id: this.generateContentId(content),
      type: 'text',
      language: contentClassification.language,
      quality: qualityMetrics,
      content: {
        topics: narrativeAnalysis.topics.map(topic => ({
          topic: topic.topic,
          confidence: topic.relevance, // Map relevance to confidence
          relevance: topic.relevance
        })),
        themes: narrativeAnalysis.themes.map(theme => ({
          theme: theme.theme,
          confidence: theme.importance, // Map importance to confidence
          occurrences: theme.occurrences
        })),
        keywords,
        entities
      },
      structure: {
        format: 'documentary', // Default format
        sections: [], // Not available in NarrativeAnalysis interface
        key_points: narrativeAnalysis.key_points
      },
      sentiment: {
        overall: 'neutral', // Default sentiment
        confidence: 0.8, // Default confidence
        emotions: [] // Simplified for now
      },
      highlights: [], // Simplified for now
      summaries,
      technical
    };
  }

  /**
   * Analyze audio content and extract metadata
   */
  async analyzeAudioContent(audioBuffer: Buffer): Promise<ContentMetadata> {
    const transcription = await this.sttService.transcribe(audioBuffer);
    const quality = await this.assessAudioQuality(audioBuffer);

    // Analyze transcribed text
    const textAnalysis = await this.analyzeTextContent(transcription.text);

    return {
      ...textAnalysis,
      type: 'audio',
      duration: transcription.segments && transcription.segments.length > 0
        ? Math.max(...transcription.segments.map(s => s.end))
        : 0,
      size: audioBuffer.length,
      quality: {
        ...textAnalysis.quality,
        clarity: quality.clarity,
        completeness: quality.completeness,
        consistency: quality.consistency
      },
    };
  }

  /**
   * Analyze video content with multi-modal analysis
   */
  async analyzeVideoContent(videoBuffer: Buffer): Promise<MultiModalAnalysis> {
    // Extract audio from video
    const audioBuffer = await this.extractAudioFromVideo(videoBuffer);

    // Get video frames for analysis
    const frames = await this.extractFramesFromVideo(videoBuffer);

    // Perform parallel analysis
    const [
      audioAnalysis,
      visualAnalysis,
      textAnalysis
    ] = await Promise.all([
      this.analyzeAudioContent(audioBuffer),
      this.analyzeVisualContent(frames),
      this.analyzeTextContent('') // Will be populated from audio transcription
    ]);

    // Calculate cross-modal correlations
    const correlation = await this.calculateCrossModalCorrelation(
      textAnalysis,
      audioAnalysis,
      visualAnalysis
    );

    return {
      text: textAnalysis,
      visual: visualAnalysis,
      correlation
    };
  }

  /**
   * Analyze visual content from frames
   */
  private async analyzeVisualContent(frames: Buffer[]): Promise<MultiModalAnalysis['visual']> {
    const sceneAnalyses = await Promise.all(
      frames.map(frame => this.visionService.analyzeFrame(frame))
    );

    const scenes = await this.visionService.detectScenes(frames);
    const quality = await this.assessVisualQuality(frames);

    return {
      scenes: scenes.scenes.map(scene => ({
        start: scene.start,
        end: scene.end,
        description: scene.description || 'Scene detected',
        shot_type: scene.shot_type || 'medium',
        movement: scene.movement || 'static',
        objects: [], // Simplified for now
        faces: [] // Simplified for now
      })),
      transitions: scenes.transitions.map((transition, index) => ({
        from_scene: index,
        to_scene: index + 1,
        type: transition.type === 'unknown' ? 'cut' : transition.type,
        duration: 0.5 // Default duration
      })),
      quality: {
        resolution: '1920x1080', // Would need actual frame analysis
        frame_rate: 30, // Would need video metadata
        brightness: 0.7, // Would need image processing
        contrast: 0.6, // Would need image processing
        sharpness: 0.8
      }
    };
  }

  /**
   * Assess text quality metrics
   */
  private async assessTextQuality(content: string): Promise<ContentMetadata['quality']> {
    const classification = await this.textService.classifyContent(content);

    return {
      clarity: classification.quality?.clarity || 0.5,
      completeness: classification.quality?.completeness || 0.5,
      consistency: classification.quality?.accuracy || 0.5
    };
  }

  /**
   * Assess audio quality metrics
   */
  private async assessAudioQuality(audioBuffer: Buffer): Promise<{
    overall: number;
    clarity: number;
    completeness: number;
    consistency: number;
    noise_level: number;
    music_detected: boolean;
  }> {
    // Use STT confidence as a proxy for audio quality
    const transcription = await this.sttService.transcribe(audioBuffer);

    return {
      overall: transcription.confidence,
      clarity: transcription.confidence,
      completeness: 1.0, // Assume complete if transcribed
      consistency: transcription.confidence,
      noise_level: 1.0 - transcription.confidence,
      music_detected: false // Would need more sophisticated analysis
    };
  }

  /**
   * Assess visual quality metrics
   */
  private async assessVisualQuality(frames: Buffer[]): Promise<{ clarity: number; completeness: number; accuracy: number; }> {
    const frameAnalyses = await Promise.all(
      frames.map(frame => this.visionService.analyzeFrame(frame))
    );

    const avgConfidence = frameAnalyses.length > 0 ?
      frameAnalyses.reduce((sum, analysis) =>
        sum + (analysis.objects.length > 0 ?
          analysis.objects.reduce((objSum, obj) => objSum + obj.confidence, 0) / analysis.objects.length : 0), 0
      ) / frameAnalyses.length : 0.5;

    return {
      clarity: avgConfidence,
      completeness: 0.8, // Default value
      accuracy: avgConfidence
    };
  }

  /**
   * Extract keywords from content
   */
  private async extractKeywords(content: string): Promise<ContentMetadata['content']['keywords']> {
    const highlights = await this.textService.extractHighlights(content);

    return highlights.keywords.map(keyword => ({
      word: keyword.word,
      frequency: keyword.frequency,
      importance: keyword.relevance
    }));
  }

  /**
   * Extract entities from content
   */
  private async extractEntities(content: string): Promise<ContentMetadata['content']['entities']> {
    // This would typically use NLP libraries or AI services
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Generate summaries at different lengths
   */
  private async generateSummaries(content: string): Promise<ContentMetadata['summaries']> {
    const highlights = await this.textService.extractHighlights(content);

    return {
      short: highlights.summary?.short || content.substring(0, 100) + '...',
      medium: highlights.summary?.medium || content.substring(0, 300) + '...',
      long: highlights.summary?.long || content.substring(0, 500) + '...'
    };
  }

  /**
   * Calculate technical metrics for content
   */
  private calculateTechnicalMetrics(content: string): ContentMetadata['technical'] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = content.split(/\s+/).filter(w => w.length > 0);

    return {
      word_count: words.length,
      sentence_count: sentences.length,
      avg_sentence_length: words.length / sentences.length,
      complexity_score: this.calculateComplexityScore(content),
      readability_score: this.calculateReadabilityScore(content)
    };
  }

  /**
   * Calculate content complexity score
   */
  private calculateComplexityScore(content: string): number {
    const words = content.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const sentences = content.split(/[.!?]+/).length;
    const avgSentenceLength = words.length / sentences;

    // Simple complexity heuristic
    return Math.min(1.0, (avgWordLength * avgSentenceLength) / 100);
  }

  /**
   * Calculate readability score using simplified Flesch Reading Ease
   */
  private calculateReadabilityScore(content: string): number {
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const syllables = this.countSyllables(content);

    if (words === 0 || sentences === 0) return 0;

    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;

    // Simplified Flesch Reading Ease formula
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

    return Math.max(0, Math.min(100, score)) / 100; // Normalize to 0-1
  }

  /**
   * Count syllables in text (simplified)
   */
  private countSyllables(text: string): number {
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiouy]+/g, 'a')
      .replace(/[^a]/g, '')
      .length;
  }

  /**
   * Calculate cross-modal correlations
   */
  private async calculateCrossModalCorrelation(
    textAnalysis: ContentMetadata,
    audioAnalysis: ContentMetadata,
    visualAnalysis: MultiModalAnalysis['visual']
  ): Promise<MultiModalAnalysis['correlation']> {
    // Simple correlation metrics
    const textAudioAlignment = this.calculateTextAudioAlignment(textAnalysis, audioAnalysis);
    const textVisualAlignment = this.calculateTextVisualAlignment(textAnalysis, visualAnalysis);
    const audioVisualAlignment = this.calculateAudioVisualAlignment(audioAnalysis, visualAnalysis);

    const inconsistencies = this.detectInconsistencies(
      textAnalysis,
      audioAnalysis,
      visualAnalysis
    );

    return {
      text_audio_alignment: textAudioAlignment,
      text_visual_alignment: textVisualAlignment,
      audio_visual_alignment: audioVisualAlignment,
      inconsistencies
    };
  }

  /**
   * Calculate alignment between text and audio content
   */
  private calculateTextAudioAlignment(
    textAnalysis: ContentMetadata,
    audioAnalysis: ContentMetadata
  ): number {
    // Simple alignment based on sentiment matching
    const sentimentMatch = textAnalysis.sentiment.overall === audioAnalysis.sentiment.overall ? 1 : 0;
    const emotionMatch = this.calculateEmotionAlignment(
      textAnalysis.sentiment.emotions,
      audioAnalysis.sentiment.emotions
    );

    return (sentimentMatch + emotionMatch) / 2;
  }

  /**
   * Calculate alignment between text and visual content
   */
  private calculateTextVisualAlignment(
    textAnalysis: ContentMetadata,
    visualAnalysis: MultiModalAnalysis['visual']
  ): number {
    // This would require more sophisticated analysis
    // For now, return a placeholder
    return 0.7;
  }

  /**
   * Calculate alignment between audio and visual content
   */
  private calculateAudioVisualAlignment(
    audioAnalysis: ContentMetadata,
    visualAnalysis: MultiModalAnalysis['visual']
  ): number {
    // This would require more sophisticated analysis
    // For now, return a placeholder
    return 0.8;
  }

  /**
   * Calculate emotion alignment between two emotion sets
   */
  private calculateEmotionAlignment(
    emotions1: Array<{ emotion: string; intensity: number; confidence: number }>,
    emotions2: Array<{ emotion: string; intensity: number; confidence: number }>
  ): number {
    if (emotions1.length === 0 || emotions2.length === 0) return 0.5;

    const primaryEmotion1 = emotions1.reduce((prev, current) =>
      prev.intensity > current.intensity ? prev : current
    );

    const primaryEmotion2 = emotions2.reduce((prev, current) =>
      prev.intensity > current.intensity ? prev : current
    );

    return primaryEmotion1.emotion === primaryEmotion2.emotion ? 1 : 0;
  }

  /**
   * Detect inconsistencies across modalities
   */
  private detectInconsistencies(
    textAnalysis: ContentMetadata,
    audioAnalysis: ContentMetadata,
    visualAnalysis: MultiModalAnalysis['visual']
  ): MultiModalAnalysis['correlation']['inconsistencies'] {
    const inconsistencies: MultiModalAnalysis['correlation']['inconsistencies'] = [];

    // Check for sentiment inconsistencies
    if (textAnalysis.sentiment.overall !== audioAnalysis.sentiment.overall) {
      inconsistencies.push({
        type: 'emotion',
        description: 'Text and audio sentiment do not match',
        severity: 'medium'
      });
    }

    // Check for content inconsistencies
    if (textAnalysis.content.topics.length === 0 && audioAnalysis.content.topics.length > 0) {
      inconsistencies.push({
        type: 'content',
        description: 'Audio contains topics not present in text',
        severity: 'high'
      });
    }

    return inconsistencies;
  }

  /**
   * Extract audio from video buffer
   */
  private async extractAudioFromVideo(videoBuffer: Buffer): Promise<Buffer> {
    // This would use FFmpeg or similar to extract audio
    // For now, return a placeholder
    return Buffer.from('extracted-audio');
  }

  /**
   * Extract frames from video buffer
   */
  private async extractFramesFromVideo(videoBuffer: Buffer): Promise<Buffer[]> {
    // This would use FFmpeg or similar to extract frames
    // For now, return placeholder frames
    return [
      Buffer.from('frame-1'),
      Buffer.from('frame-2'),
      Buffer.from('frame-3')
    ];
  }

  /**
   * Generate unique content ID
   */
  private generateContentId(content: string): string {
    // Simple hash-based ID generation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Search content by query
   */
  async searchContent(
    contentLibrary: ContentMetadata[],
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      contentTypes?: string[];
    } = {}
  ): Promise<Array<{
    content: ContentMetadata;
    relevance: number;
    matches: string[];
  }>> {
    const { limit = 10, threshold = 0.3, contentTypes } = options;

    const results = [];

    for (const content of contentLibrary) {
      if (contentTypes && !contentTypes.includes(content.type)) {
        continue;
      }

      const relevance = this.calculateRelevance(content, query);
      const matches = this.findMatches(content, query);

      if (relevance >= threshold) {
        results.push({
          content,
          relevance,
          matches
        });
      }
    }

    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);
  }

  /**
   * Calculate relevance score for content against query
   */
  private calculateRelevance(content: ContentMetadata, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Check keywords
    for (const keyword of content.content.keywords) {
      if (keyword.word.toLowerCase().includes(queryLower)) {
        score += keyword.importance * 0.4;
      }
    }

    // Check topics
    for (const topic of content.content.topics) {
      if (topic.topic.toLowerCase().includes(queryLower)) {
        score += topic.relevance * 0.3;
      }
    }

    // Check themes
    for (const theme of content.content.themes) {
      if (theme.theme.toLowerCase().includes(queryLower)) {
        score += theme.confidence * 0.2;
      }
    }

    // Check summaries
    if (content.summaries.short.toLowerCase().includes(queryLower)) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Find specific matches in content
   */
  private findMatches(content: ContentMetadata, query: string): string[] {
    const matches = [];
    const queryLower = query.toLowerCase();

    // Find in highlights
    for (const highlight of content.highlights) {
      if (highlight.text.toLowerCase().includes(queryLower)) {
        matches.push(highlight.text);
      }
    }

    // Find in key points
    for (const keyPoint of content.structure.key_points) {
      if (keyPoint.toLowerCase().includes(queryLower)) {
        matches.push(keyPoint);
      }
    }

    return matches;
  }

  /**
   * Compare two content items for similarity
   */
  async compareContent(
    content1: ContentMetadata,
    content2: ContentMetadata
  ): Promise<{
    similarity: number;
    common_topics: string[];
    common_themes: string[];
    differences: string[];
  }> {
    const topicSimilarity = this.calculateTopicSimilarity(
      content1.content.topics,
      content2.content.topics
    );

    const themeSimilarity = this.calculateThemeSimilarity(
      content1.content.themes,
      content2.content.themes
    );

    const keywordSimilarity = this.calculateKeywordSimilarity(
      content1.content.keywords,
      content2.content.keywords
    );

    const overallSimilarity = (topicSimilarity + themeSimilarity + keywordSimilarity) / 3;

    const commonTopics = content1.content.topics
      .filter(t1 => content2.content.topics.some(t2 => t2.topic === t1.topic))
      .map(t => t.topic);

    const commonThemes = content1.content.themes
      .filter(t1 => content2.content.themes.some(t2 => t2.theme === t1.theme))
      .map(t => t.theme);

    const differences = this.identifyDifferences(content1, content2);

    return {
      similarity: overallSimilarity,
      common_topics: commonTopics,
      common_themes: commonThemes,
      differences
    };
  }

  /**
   * Calculate similarity between topic sets
   */
  private calculateTopicSimilarity(
    topics1: ContentMetadata['content']['topics'],
    topics2: ContentMetadata['content']['topics']
  ): number {
    if (topics1.length === 0 && topics2.length === 0) return 1.0;
    if (topics1.length === 0 || topics2.length === 0) return 0.0;

    const commonTopics = topics1.filter(t1 =>
      topics2.some(t2 => t2.topic === t1.topic)
    );

    return commonTopics.length / Math.max(topics1.length, topics2.length);
  }

  /**
   * Calculate similarity between theme sets
   */
  private calculateThemeSimilarity(
    themes1: ContentMetadata['content']['themes'],
    themes2: ContentMetadata['content']['themes']
  ): number {
    if (themes1.length === 0 && themes2.length === 0) return 1.0;
    if (themes1.length === 0 || themes2.length === 0) return 0.0;

    const commonThemes = themes1.filter(t1 =>
      themes2.some(t2 => t2.theme === t1.theme)
    );

    return commonThemes.length / Math.max(themes1.length, themes2.length);
  }

  /**
   * Calculate similarity between keyword sets
   */
  private calculateKeywordSimilarity(
    keywords1: ContentMetadata['content']['keywords'],
    keywords2: ContentMetadata['content']['keywords']
  ): number {
    if (keywords1.length === 0 && keywords2.length === 0) return 1.0;
    if (keywords1.length === 0 || keywords2.length === 0) return 0.0;

    const commonKeywords = keywords1.filter(k1 =>
      keywords2.some(k2 => k2.word === k1.word)
    );

    return commonKeywords.length / Math.max(keywords1.length, keywords2.length);
  }

  /**
   * Identify differences between two content items
   */
  private identifyDifferences(
    content1: ContentMetadata,
    content2: ContentMetadata
  ): string[] {
    const differences = [];

    if (content1.type !== content2.type) {
      differences.push(`Content types differ: ${content1.type} vs ${content2.type}`);
    }

    if (content1.language !== content2.language) {
      differences.push(`Languages differ: ${content1.language} vs ${content2.language}`);
    }

    if (content1.sentiment.overall !== content2.sentiment.overall) {
      differences.push(`Sentiment differs: ${content1.sentiment.overall} vs ${content2.sentiment.overall}`);
    }

    if (content1.structure.format !== content2.structure.format) {
      differences.push(`Structure differs: ${content1.structure.format} vs ${content2.structure.format}`);
    }

    return differences;
  }
}