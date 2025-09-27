export interface TextAnalysisConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  model?: string;
}

export interface NarrativeAnalysis {
  structure: 'linear' | 'non_linear' | 'episodic' | 'documentary' | 'interview' | 'unknown';
  key_points: string[];
  themes: Array<{
    theme: string;
    importance: number;
    occurrences: number;
  }>;
  sentiment: {
    overall: 'positive' | 'negative' | 'neutral' | 'mixed';
    progression: Array<{
      timestamp: number;
      sentiment: 'positive' | 'negative' | 'neutral';
      confidence: number;
    }>;
  };
  characters?: Array<{
    name: string;
    role: string;
    importance: number;
    mentions: number;
  }>;
  topics: Array<{
    topic: string;
    relevance: number;
    mentions: number;
  }>;
}

export interface HighlightExtraction {
  highlights: Array<{
    text: string;
    importance: number;
    timestamp?: number;
    category: 'emotional' | 'informational' | 'action' | 'dialogue' | 'visual';
    reason: string;
  }>;
  summary: {
    short: string;
    medium: string;
    long: string;
  };
  keywords: Array<{
    word: string;
    relevance: number;
    frequency: number;
  }>;
}

export interface EmotionAnalysis {
  emotions: Array<{
    label: string;
    confidence: number;
    intensity: 'low' | 'medium' | 'high';
  }>;
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0 (calm) to 1 (excited)
  dominance: number; // 0 (submissive) to 1 (dominant)
}

export interface ContentClassification {
  categories: Array<{
    category: string;
    confidence: number;
    subcategory?: string;
  }>;
  content_type: 'speech' | 'music' | 'noise' | 'silence' | 'mixed';
  language: string;
  quality: {
    clarity: number;
    completeness: number;
    accuracy: number;
  };
}

export interface TextAnalysisOptions {
  includeNarrative?: boolean;
  includeHighlights?: boolean;
  includeEmotions?: boolean;
  includeClassification?: boolean;
  context?: string;
  maxLength?: number;
}

export class TextAnalysisService {
  private config: TextAnalysisConfig;

  constructor(config: TextAnalysisConfig) {
    this.config = config;
  }

  async analyzeNarrative(text: string, options: TextAnalysisOptions = {}): Promise<NarrativeAnalysis> {
    try {
      const analysis: NarrativeAnalysis = {
        structure: 'unknown',
        key_points: [],
        themes: [],
        sentiment: {
          overall: 'neutral',
          progression: [],
        },
        topics: [],
      };

      // Narrative structure analysis
      if (options.includeNarrative !== false) {
        analysis.structure = await this.analyzeNarrativeStructure(text);
        analysis.key_points = await this.extractKeyPoints(text);
        analysis.themes = await this.extractThemes(text);
        analysis.sentiment = await this.analyzeSentiment(text);
        analysis.characters = await this.extractCharacters(text);
        analysis.topics = await this.extractTopics(text);
      }

      return analysis;
    } catch (error) {
      throw new Error(`Narrative analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractHighlights(text: string, options: TextAnalysisOptions = {}): Promise<HighlightExtraction> {
    try {
      const highlights: HighlightExtraction = {
        highlights: [],
        summary: {
          short: '',
          medium: '',
          long: '',
        },
        keywords: [],
      };

      // Highlight extraction
      if (options.includeHighlights !== false) {
        highlights.highlights = await this.extractImportantSegments(text);
        highlights.summary = await this.generateSummaries(text);
        highlights.keywords = await this.extractKeywords(text);
      }

      return highlights;
    } catch (error) {
      throw new Error(`Highlight extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectEmotions(text: string, options: TextAnalysisOptions = {}): Promise<EmotionAnalysis> {
    try {
      const emotions: EmotionAnalysis = {
        emotions: [],
        valence: 0,
        arousal: 0,
        dominance: 0,
      };

      // Emotion detection
      if (options.includeEmotions !== false) {
        emotions.emotions = await this.detectEmotionalContent(text);
        emotions.valence = await this.calculateValence(text);
        emotions.arousal = await this.calculateArousal(text);
        emotions.dominance = await this.calculateDominance(text);
      }

      return emotions;
    } catch (error) {
      throw new Error(`Emotion detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async classifyContent(text: string, options: TextAnalysisOptions = {}): Promise<ContentClassification> {
    try {
      const classification: ContentClassification = {
        categories: [],
        content_type: 'speech',
        language: 'en',
        quality: {
          clarity: 0,
          completeness: 0,
          accuracy: 0,
        },
      };

      // Content classification
      if (options.includeClassification !== false) {
        classification.categories = await this.categorizeContent(text);
        classification.content_type = await this.determineContentType(text);
        classification.language = await this.detectLanguage(text);
        classification.quality = await this.assessQuality(text);
      }

      return classification;
    } catch (error) {
      throw new Error(`Content classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeNarrativeStructure(text: string): Promise<NarrativeAnalysis['structure']> {
    try {
      const analysis = await this.callGeminiAPI(text, 'narrative_structure');

      // Determine structure based on content patterns
      if (analysis.has_chronological_order) return 'linear';
      if (analysis.has_episodes) return 'episodic';
      if (analysis.has_interviews) return 'interview';
      if (analysis.is_documentary_style) return 'documentary';
      if (analysis.is_non_linear) return 'non_linear';

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  private async extractKeyPoints(text: string): Promise<string[]> {
    try {
      const keyPoints = await this.callGeminiAPI(text, 'key_points');
      return keyPoints.points || [];
    } catch (error) {
      return [];
    }
  }

  private async extractThemes(text: string): Promise<NarrativeAnalysis['themes']> {
    try {
      const themes = await this.callGeminiAPI(text, 'themes');
      return themes.map((theme: any) => ({
        theme: theme.name,
        importance: theme.importance,
        occurrences: theme.occurrences,
      }));
    } catch (error) {
      return [];
    }
  }

  private async analyzeSentiment(text: string): Promise<NarrativeAnalysis['sentiment']> {
    try {
      const sentiment = await this.callGeminiAPI(text, 'sentiment_analysis');

      return {
        overall: sentiment.overall,
        progression: sentiment.progression || [],
      };
    } catch (error) {
      return {
        overall: 'neutral',
        progression: [],
      };
    }
  }

  private async extractCharacters(text: string): Promise<NarrativeAnalysis['characters']> {
    try {
      const characters = await this.callGeminiAPI(text, 'character_extraction');
      return characters.map((char: any) => ({
        name: char.name,
        role: char.role,
        importance: char.importance,
        mentions: char.mentions,
      }));
    } catch (error) {
      return [];
    }
  }

  private async extractTopics(text: string): Promise<NarrativeAnalysis['topics']> {
    try {
      const topics = await this.callGeminiAPI(text, 'topic_extraction');
      return topics.map((topic: any) => ({
        topic: topic.name,
        relevance: topic.relevance,
        mentions: topic.mentions,
      }));
    } catch (error) {
      return [];
    }
  }

  private async extractImportantSegments(text: string): Promise<HighlightExtraction['highlights']> {
    try {
      const segments = await this.callGeminiAPI(text, 'highlight_extraction');

      return segments.map((segment: any) => ({
        text: segment.text,
        importance: segment.importance,
        timestamp: segment.timestamp,
        category: segment.category,
        reason: segment.reason,
      }));
    } catch (error) {
      return [];
    }
  }

  private async generateSummaries(text: string): Promise<HighlightExtraction['summary']> {
    try {
      const summaries = await this.callGeminiAPI(text, 'summarization');

      return {
        short: summaries.short || '',
        medium: summaries.medium || '',
        long: summaries.long || '',
      };
    } catch (error) {
      return {
        short: '',
        medium: '',
        long: '',
      };
    }
  }

  private async extractKeywords(text: string): Promise<HighlightExtraction['keywords']> {
    try {
      const keywords = await this.callGeminiAPI(text, 'keyword_extraction');

      return keywords.map((keyword: any) => ({
        word: keyword.word,
        relevance: keyword.relevance,
        frequency: keyword.frequency,
      }));
    } catch (error) {
      return [];
    }
  }

  private async detectEmotionalContent(text: string): Promise<EmotionAnalysis['emotions']> {
    try {
      const emotions = await this.callGeminiAPI(text, 'emotion_detection');

      return emotions.map((emotion: any) => ({
        label: emotion.label,
        confidence: emotion.confidence,
        intensity: emotion.intensity,
      }));
    } catch (error) {
      return [];
    }
  }

  private async calculateValence(text: string): Promise<number> {
    try {
      const valence = await this.callGeminiAPI(text, 'valence_calculation');
      return valence.score || 0;
    } catch (error) {
      return 0;
    }
  }

  private async calculateArousal(text: string): Promise<number> {
    try {
      const arousal = await this.callGeminiAPI(text, 'arousal_calculation');
      return arousal.score || 0;
    } catch (error) {
      return 0;
    }
  }

  private async calculateDominance(text: string): Promise<number> {
    try {
      const dominance = await this.callGeminiAPI(text, 'dominance_calculation');
      return dominance.score || 0;
    } catch (error) {
      return 0;
    }
  }

  private async categorizeContent(text: string): Promise<ContentClassification['categories']> {
    try {
      const categories = await this.callGeminiAPI(text, 'content_categorization');

      return categories.map((category: any) => ({
        category: category.name,
        confidence: category.confidence,
        subcategory: category.subcategory,
      }));
    } catch (error) {
      return [];
    }
  }

  private async determineContentType(text: string): Promise<ContentClassification['content_type']> {
    try {
      const contentType = await this.callGeminiAPI(text, 'content_type_detection');
      return contentType.type || 'speech';
    } catch (error) {
      return 'speech';
    }
  }

  private async detectLanguage(text: string): Promise<string> {
    try {
      const language = await this.callGeminiAPI(text, 'language_detection');
      return language.code || 'en';
    } catch (error) {
      return 'en';
    }
  }

  private async assessQuality(text: string): Promise<ContentClassification['quality']> {
    try {
      const quality = await this.callGeminiAPI(text, 'quality_assessment');

      return {
        clarity: quality.clarity || 0,
        completeness: quality.completeness || 0,
        accuracy: quality.accuracy || 0,
      };
    } catch (error) {
      return {
        clarity: 0,
        completeness: 0,
        accuracy: 0,
      };
    }
  }

  private async callGeminiAPI(text: string, task: string): Promise<any> {
    try {
      // This is a placeholder for the actual Gemini Pro API integration
      // In a real implementation, this would make HTTP requests to the Gemini Pro API

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Return mock data based on task type
      switch (task) {
        case 'narrative_structure':
          return {
            has_chronological_order: true,
            has_episodes: false,
            has_interviews: false,
            is_documentary_style: false,
            is_non_linear: false,
          };

        case 'key_points':
          return {
            points: [
              'Introduction of main topic',
              'Key argument presented',
              'Supporting evidence provided',
              'Conclusion reached',
            ],
          };

        case 'themes':
          return [
            { name: 'Technology', importance: 0.8, occurrences: 5 },
            { name: 'Innovation', importance: 0.7, occurrences: 3 },
            { name: 'Future', importance: 0.6, occurrences: 4 },
          ];

        case 'sentiment_analysis':
          return {
            overall: 'positive',
            progression: [
              { timestamp: 0, sentiment: 'neutral', confidence: 0.8 },
              { timestamp: 30, sentiment: 'positive', confidence: 0.9 },
              { timestamp: 60, sentiment: 'positive', confidence: 0.85 },
            ],
          };

        case 'character_extraction':
          return [
            { name: 'Speaker', role: 'presenter', importance: 0.9, mentions: 15 },
          ];

        case 'topic_extraction':
          return [
            { name: 'Artificial Intelligence', relevance: 0.9, mentions: 8 },
            { name: 'Machine Learning', relevance: 0.8, mentions: 5 },
            { name: 'Automation', relevance: 0.7, mentions: 3 },
          ];

        case 'highlight_extraction':
          return [
            {
              text: 'The most important breakthrough in AI technology',
              importance: 0.95,
              timestamp: 45,
              category: 'informational',
              reason: 'Contains key technical information',
            },
          ];

        case 'summarization':
          return {
            short: 'AI technology breakthrough discussed.',
            medium: 'The speaker discusses recent breakthroughs in artificial intelligence and their potential impact on various industries.',
            long: 'In this presentation, the speaker provides a comprehensive overview of recent developments in artificial intelligence, focusing on machine learning advancements and their practical applications across different sectors including healthcare, finance, and transportation.',
          };

        case 'keyword_extraction':
          return [
            { word: 'artificial intelligence', relevance: 0.9, frequency: 8 },
            { word: 'machine learning', relevance: 0.8, frequency: 5 },
            { word: 'technology', relevance: 0.7, frequency: 12 },
          ];

        case 'emotion_detection':
          return [
            { label: 'enthusiasm', confidence: 0.85, intensity: 'high' },
            { label: 'confidence', confidence: 0.78, intensity: 'medium' },
          ];

        case 'valence_calculation':
          return { score: 0.7 };

        case 'arousal_calculation':
          return { score: 0.6 };

        case 'dominance_calculation':
          return { score: 0.8 };

        case 'content_categorization':
          return [
            { name: 'Technology', confidence: 0.9, subcategory: 'Artificial Intelligence' },
            { name: 'Education', confidence: 0.7, subcategory: 'Presentation' },
          ];

        case 'content_type_detection':
          return { type: 'speech' };

        case 'language_detection':
          return { code: 'en' };

        case 'quality_assessment':
          return {
            clarity: 0.85,
            completeness: 0.90,
            accuracy: 0.88,
          };

        default:
          return {};
      }
    } catch (error) {
      throw new Error(`Gemini Pro API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<void> {
    try {
      // Simple health check with a minimal text
      const testText = 'Hello world';
      await this.analyzeNarrativeStructure(testText);
    } catch (error) {
      if (error instanceof Error && error.message.includes('API key')) {
        throw new Error('Invalid API key');
      }
      throw new Error('Gemini Pro service unavailable');
    }
  }

  getConfig(): TextAnalysisConfig {
    return { ...this.config };
  }

  // Batch processing for multiple texts
  async analyzeTextsBatch(texts: string[], options: TextAnalysisOptions = {}): Promise<NarrativeAnalysis[]> {
    const promises = texts.map(text => this.analyzeNarrative(text, options));
    return Promise.all(promises);
  }

  // Real-time analysis for streaming text
  async startRealtimeAnalysis(
    textStream: ReadableStream<string>,
    options: TextAnalysisOptions = {},
    onResult: (result: Partial<NarrativeAnalysis>) => void
  ): Promise<void> {
    // Placeholder for real-time analysis
    // This would process streaming text as it arrives
    throw new Error('Real-time analysis not yet implemented');
  }

  // Content comparison
  async compareContent(text1: string, text2: string): Promise<{
    similarity: number;
    differences: string[];
    common_themes: string[];
  }> {
    try {
      const comparison = await this.callGeminiAPI(
        `Text 1: ${text1}\n\nText 2: ${text2}`,
        'content_comparison'
      );

      return {
        similarity: comparison.similarity || 0,
        differences: comparison.differences || [],
        common_themes: comparison.common_themes || [],
      };
    } catch (error) {
      throw new Error(`Content comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Content generation based on analysis
  async generateContent(prompt: string, style: 'formal' | 'casual' | 'technical' = 'formal'): Promise<string> {
    try {
      const generation = await this.callGeminiAPI(
        `Prompt: ${prompt}\nStyle: ${style}`,
        'content_generation'
      );

      return generation.text || '';
    } catch (error) {
      throw new Error(`Content generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}