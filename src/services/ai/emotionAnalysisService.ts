import { TextAnalysisService } from './textAnalysisService';
import { VisionService } from './visionService';

export interface SpeakerEmotionProfile {
  speakerId: string;
  name?: string;
  baselineEmotions: {
    valence: number;
    arousal: number;
    dominance: number;
  };
  emotionalRange: {
    valenceRange: [number, number];
    arousalRange: [number, number];
    dominanceRange: [number, number];
  };
  dominantEmotions: Array<{
    emotion: string;
    frequency: number;
    averageIntensity: number;
  }>;
  emotionalShifts: Array<{
    timestamp: number;
    fromEmotion: string;
    toEmotion: string;
    intensity: number;
  }>;
}

export interface ConversationEmotionFlow {
  overall: {
    valence: number;
    arousal: number;
    dominance: number;
  };
  progression: Array<{
    timestamp: number;
    speakerId: string;
    emotions: Array<{
      label: string;
      confidence: number;
      intensity: 'low' | 'medium' | 'high';
    }>;
    valence: number;
    arousal: number;
    dominance: number;
  }>;
  interactions: Array<{
    speaker1: string;
    speaker2: string;
    emotionalInfluence: number;
    rapport: number;
  }>;
}

export interface EmotionalHighlight {
  timestamp: number;
  speakerId?: string;
  emotion: string;
  intensity: number;
  context: string;
  significance: 'low' | 'medium' | 'high';
  reason: string;
}

export interface EmotionAnalysisOptions {
  includeSpeakerProfiles?: boolean;
  includeConversationFlow?: boolean;
  includeHighlights?: boolean;
  includeVisualEmotions?: boolean;
  timeWindow?: number; // seconds
  emotionThreshold?: number;
}

export class EmotionAnalysisService {
  private textService: TextAnalysisService;
  private visionService: VisionService;

  constructor(textConfig: any, visionConfig: any) {
    this.textService = new TextAnalysisService(textConfig);
    this.visionService = new VisionService(visionConfig);
  }

  async analyzeSpeakerEmotions(
    segments: Array<{
      speakerId: string;
      text: string;
      start: number;
      end: number;
    }>,
    options: EmotionAnalysisOptions = {}
  ): Promise<SpeakerEmotionProfile[]> {
    try {
      const profiles = new Map<string, SpeakerEmotionProfile>();

      // Analyze each speaker's segments
      for (const segment of segments) {
        const emotions = await this.textService.detectEmotions(segment.text);

        if (!profiles.has(segment.speakerId)) {
          profiles.set(segment.speakerId, {
            speakerId: segment.speakerId,
            baselineEmotions: { valence: 0, arousal: 0, dominance: 0 },
            emotionalRange: {
              valenceRange: [0, 0],
              arousalRange: [0, 0],
              dominanceRange: [0, 0],
            },
            dominantEmotions: [],
            emotionalShifts: [],
          });
        }

        const profile = profiles.get(segment.speakerId)!;
        this.updateSpeakerProfile(profile, emotions, segment.start);
      }

      // Calculate baselines and ranges
      for (const profile of profiles.values()) {
        this.calculateSpeakerBaseline(profile);
        this.identifyDominantEmotions(profile);
      }

      return Array.from(profiles.values());
    } catch (error) {
      throw new Error(`Speaker emotion analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeConversationFlow(
    segments: Array<{
      speakerId: string;
      text: string;
      start: number;
      end: number;
    }>,
    options: EmotionAnalysisOptions = {}
  ): Promise<ConversationEmotionFlow> {
    try {
      const progression: ConversationEmotionFlow['progression'] = [];
      const interactions: ConversationEmotionFlow['interactions'] = [];

      let previousSpeaker: string | null = null;
      let previousEmotions: any = null;

      for (const segment of segments) {
        const emotions = await this.textService.detectEmotions(segment.text);

        progression.push({
          timestamp: segment.start,
          speakerId: segment.speakerId,
          emotions: emotions.emotions,
          valence: emotions.valence,
          arousal: emotions.arousal,
          dominance: emotions.dominance,
        });

        // Analyze interaction if there's a speaker change
        if (previousSpeaker && previousSpeaker !== segment.speakerId) {
          const influence = this.calculateEmotionalInfluence(previousEmotions, emotions);
          const rapport = this.calculateRapport(previousEmotions, emotions);

          interactions.push({
            speaker1: previousSpeaker,
            speaker2: segment.speakerId,
            emotionalInfluence: influence,
            rapport: rapport,
          });
        }

        previousSpeaker = segment.speakerId;
        previousEmotions = emotions;
      }

      // Calculate overall emotional state
      const overall = this.calculateOverallEmotion(progression);

      return {
        overall,
        progression,
        interactions,
      };
    } catch (error) {
      throw new Error(`Conversation flow analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractEmotionalHighlights(
    segments: Array<{
      speakerId: string;
      text: string;
      start: number;
      end: number;
    }>,
    options: EmotionAnalysisOptions = {}
  ): Promise<EmotionalHighlight[]> {
    try {
      const highlights: EmotionalHighlight[] = [];
      const threshold = options.emotionThreshold || 0.7;

      for (const segment of segments) {
        const emotions = await this.textService.detectEmotions(segment.text);

        // Find high-intensity emotions
        const significantEmotions = emotions.emotions.filter(e => e.confidence >= threshold);

        for (const emotion of significantEmotions) {
          const significance = this.assessEmotionalSignificance(emotion, emotions);

          if (significance !== 'low') {
            highlights.push({
              timestamp: segment.start,
              speakerId: segment.speakerId,
              emotion: emotion.label,
              intensity: emotion.confidence,
              context: segment.text,
              significance,
              reason: this.generateHighlightReason(emotion, segment.text),
            });
          }
        }
      }

      // Sort by significance and intensity
      return highlights.sort((a, b) => {
        const significanceOrder = { high: 3, medium: 2, low: 1 };
        const aScore = significanceOrder[a.significance] * a.intensity;
        const bScore = significanceOrder[b.significance] * b.intensity;
        return bScore - aScore;
      });
    } catch (error) {
      throw new Error(`Emotional highlights extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeCrossModalEmotions(
    textSegments: Array<{
      speakerId: string;
      text: string;
      start: number;
      end: number;
    }>,
    videoFrames: Buffer[],
    options: EmotionAnalysisOptions = {}
  ): Promise<{
    textEmotions: SpeakerEmotionProfile[];
    visualEmotions: any[];
    correlations: Array<{
      timestamp: number;
      textEmotion: string;
      visualEmotion: string;
      correlation: number;
    }>;
  }> {
    try {
      // Analyze text-based emotions
      const textEmotions = await this.analyzeSpeakerEmotions(textSegments, options);

      // Analyze visual emotions from frames
      const visualEmotions = await this.visionService.analyzeFramesBatch(videoFrames, {
        includeFaces: true,
      });

      // Find correlations between text and visual emotions
      const correlations = this.findEmotionCorrelations(textSegments, visualEmotions);

      return {
        textEmotions,
        visualEmotions,
        correlations,
      };
    } catch (error) {
      throw new Error(`Cross-modal emotion analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private updateSpeakerProfile(
    profile: SpeakerEmotionProfile,
    emotions: any,
    timestamp: number
  ): void {
    // Update emotional values (simple moving average)
    const alpha = 0.1; // Learning rate for emotional baseline

    profile.baselineEmotions.valence =
      profile.baselineEmotions.valence * (1 - alpha) + emotions.valence * alpha;

    profile.baselineEmotions.arousal =
      profile.baselineEmotions.arousal * (1 - alpha) + emotions.arousal * alpha;

    profile.baselineEmotions.dominance =
      profile.baselineEmotions.dominance * (1 - alpha) + emotions.dominance * alpha;

    // Update emotional ranges
    profile.emotionalRange.valenceRange[0] = Math.min(
      profile.emotionalRange.valenceRange[0],
      emotions.valence
    );
    profile.emotionalRange.valenceRange[1] = Math.max(
      profile.emotionalRange.valenceRange[1],
      emotions.valence
    );

    profile.emotionalRange.arousalRange[0] = Math.min(
      profile.emotionalRange.arousalRange[0],
      emotions.arousal
    );
    profile.emotionalRange.arousalRange[1] = Math.max(
      profile.emotionalRange.arousalRange[1],
      emotions.arousal
    );

    profile.emotionalRange.dominanceRange[0] = Math.min(
      profile.emotionalRange.dominanceRange[0],
      emotions.dominance
    );
    profile.emotionalRange.dominanceRange[1] = Math.max(
      profile.emotionalRange.dominanceRange[1],
      emotions.dominance
    );
  }

  private calculateSpeakerBaseline(profile: SpeakerEmotionProfile): void {
    // Baseline is already calculated in updateSpeakerProfile
    // This method can be used for additional baseline calculations
  }

  private identifyDominantEmotions(profile: SpeakerEmotionProfile): void {
    // This would typically require tracking emotion frequencies over time
    // For now, we'll use a simplified approach
    profile.dominantEmotions = [
      { emotion: 'neutral', frequency: 0.5, averageIntensity: 0.5 },
    ];
  }

  private calculateEmotionalInfluence(fromEmotions: any, toEmotions: any): number {
    // Calculate how much the first speaker's emotions influenced the second
    const valenceDiff = Math.abs(toEmotions.valence - fromEmotions.valence);
    const arousalDiff = Math.abs(toEmotions.arousal - fromEmotions.arousal);

    // Higher difference might indicate stronger influence
    return Math.min((valenceDiff + arousalDiff) / 2, 1);
  }

  private calculateRapport(fromEmotions: any, toEmotions: any): number {
    // Calculate emotional rapport between speakers
    const valenceSimilarity = 1 - Math.abs(toEmotions.valence - fromEmotions.valence);
    const arousalSimilarity = 1 - Math.abs(toEmotions.arousal - fromEmotions.arousal);

    return (valenceSimilarity + arousalSimilarity) / 2;
  }

  private calculateOverallEmotion(progression: ConversationEmotionFlow['progression']) {
    if (progression.length === 0) {
      return { valence: 0, arousal: 0, dominance: 0 };
    }

    const totals = progression.reduce(
      (acc, curr) => ({
        valence: acc.valence + curr.valence,
        arousal: acc.arousal + curr.arousal,
        dominance: acc.dominance + curr.dominance,
      }),
      { valence: 0, arousal: 0, dominance: 0 }
    );

    const count = progression.length;
    return {
      valence: totals.valence / count,
      arousal: totals.arousal / count,
      dominance: totals.dominance / count,
    };
  }

  private assessEmotionalSignificance(emotion: any, allEmotions: any): 'low' | 'medium' | 'high' {
    const intensity = emotion.confidence;

    if (intensity > 0.8) return 'high';
    if (intensity > 0.6) return 'medium';
    return 'low';
  }

  private generateHighlightReason(emotion: any, context: string): string {
    return `High-intensity ${emotion.label} emotion detected in context: "${context.substring(0, 50)}..."`;
  }

  private findEmotionCorrelations(
    textSegments: Array<{ start: number; speakerId: string; text: string }>,
    visualEmotions: any[]
  ) {
    const correlations = [];

    // Simplified correlation finding
    // In a real implementation, this would align timestamps and compare emotions

    for (let i = 0; i < Math.min(textSegments.length, visualEmotions.length); i++) {
      const textSegment = textSegments[i];
      const visualFrame = visualEmotions[i];

      if (visualFrame.faces && visualFrame.faces.length > 0) {
        const visualEmotion = visualFrame.faces[0].emotions?.[0]?.label || 'neutral';
        const textEmotion = 'neutral'; // Would need to calculate from text

        correlations.push({
          timestamp: textSegment.start,
          textEmotion,
          visualEmotion,
          correlation: this.calculateEmotionCorrelation(textEmotion, visualEmotion),
        });
      }
    }

    return correlations;
  }

  private calculateEmotionCorrelation(textEmotion: string, visualEmotion: string): number {
    // Simple emotion correlation based on emotion similarity
    const emotionGroups = {
      positive: ['joy', 'happiness', 'excitement', 'surprise'],
      negative: ['sadness', 'anger', 'fear', 'disgust'],
      neutral: ['neutral', 'calm'],
    };

    const getGroup = (emotion: string) => {
      if (emotionGroups.positive.includes(emotion)) return 'positive';
      if (emotionGroups.negative.includes(emotion)) return 'negative';
      return 'neutral';
    };

    const textGroup = getGroup(textEmotion);
    const visualGroup = getGroup(visualEmotion);

    if (textGroup === visualGroup) return 1;
    if ((textGroup === 'positive' && visualGroup === 'negative') ||
        (textGroup === 'negative' && visualGroup === 'positive')) return -1;
    return 0;
  }

  async analyzeEmotionalJourney(
    segments: Array<{
      speakerId: string;
      text: string;
      start: number;
      end: number;
    }>
  ): Promise<{
    journey: Array<{
      phase: string;
      startTime: number;
      endTime: number;
      dominantEmotion: string;
      intensity: number;
      description: string;
    }>;
    turningPoints: Array<{
      timestamp: number;
      fromEmotion: string;
      toEmotion: string;
      significance: number;
    }>;
  }> {
    try {
      const journey = [];
      const turningPoints = [];

      let currentPhase = 'neutral';
      let phaseStart = segments[0]?.start || 0;
      let previousEmotions: any = null;

      for (const segment of segments) {
        const emotions = await this.textService.detectEmotions(segment.text);

        // Detect phase changes
        const dominantEmotion = emotions.emotions[0]?.label || 'neutral';
        const intensity = emotions.emotions[0]?.confidence || 0;

        if (dominantEmotion !== currentPhase && intensity > 0.6) {
          // End previous phase
          if (currentPhase !== 'neutral') {
            journey.push({
              phase: currentPhase,
              startTime: phaseStart,
              endTime: segment.start,
              dominantEmotion: currentPhase,
              intensity: previousEmotions?.emotions[0]?.confidence || 0,
              description: `Phase characterized by ${currentPhase} emotions`,
            });
          }

          // Detect turning point
          if (previousEmotions && this.isSignificantEmotionalShift(previousEmotions, emotions)) {
            turningPoints.push({
              timestamp: segment.start,
              fromEmotion: previousEmotions.emotions[0]?.label || 'neutral',
              toEmotion: dominantEmotion,
              significance: Math.abs(emotions.valence - previousEmotions.valence),
            });
          }

          // Start new phase
          currentPhase = dominantEmotion;
          phaseStart = segment.start;
        }

        previousEmotions = emotions;
      }

      // Add final phase
      if (currentPhase !== 'neutral') {
        journey.push({
          phase: currentPhase,
          startTime: phaseStart,
          endTime: segments[segments.length - 1]?.end || 0,
          dominantEmotion: currentPhase,
          intensity: previousEmotions?.emotions[0]?.confidence || 0,
          description: `Final phase characterized by ${currentPhase} emotions`,
        });
      }

      return { journey, turningPoints };
    } catch (error) {
      throw new Error(`Emotional journey analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private isSignificantEmotionalShift(fromEmotions: any, toEmotions: any): boolean {
    const valenceShift = Math.abs(toEmotions.valence - fromEmotions.valence);
    const arousalShift = Math.abs(toEmotions.arousal - fromEmotions.arousal);

    // Consider it significant if there's a large shift in either dimension
    return valenceShift > 0.5 || arousalShift > 0.5;
  }

  async generateEmotionSummary(
    segments: Array<{
      speakerId: string;
      text: string;
      start: number;
      end: number;
    }>
  ): Promise<{
    overallMood: string;
    keyEmotionalMoments: string[];
    speakerComparison: Array<{
      speakerId: string;
      dominantEmotion: string;
      emotionalVariability: number;
    }>;
    recommendations: string[];
  }> {
    try {
      const speakerProfiles = await this.analyzeSpeakerEmotions(segments);
      const highlights = await this.extractEmotionalHighlights(segments);

      // Determine overall mood
      const overallMood = this.determineOverallMood(speakerProfiles);

      // Extract key moments
      const keyEmotionalMoments = highlights
        .filter(h => h.significance === 'high')
        .map(h => h.context);

      // Compare speakers
      const speakerComparison = speakerProfiles.map(profile => ({
        speakerId: profile.speakerId,
        dominantEmotion: profile.dominantEmotions[0]?.emotion || 'neutral',
        emotionalVariability: this.calculateEmotionalVariability(profile),
      }));

      // Generate recommendations
      const recommendations = this.generateEmotionRecommendations(speakerProfiles, highlights);

      return {
        overallMood,
        keyEmotionalMoments,
        speakerComparison,
        recommendations,
      };
    } catch (error) {
      throw new Error(`Emotion summary generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private determineOverallMood(profiles: SpeakerEmotionProfile[]): string {
    const avgValence = profiles.reduce((sum, p) => sum + p.baselineEmotions.valence, 0) / profiles.length;
    const avgArousal = profiles.reduce((sum, p) => sum + p.baselineEmotions.arousal, 0) / profiles.length;

    if (avgValence > 0.3 && avgArousal > 0.4) return 'positive_energetic';
    if (avgValence > 0.3 && avgArousal <= 0.4) return 'positive_calm';
    if (avgValence <= 0.3 && avgValence > -0.3 && avgArousal <= 0.4) return 'neutral';
    if (avgValence <= -0.3 && avgArousal > 0.4) return 'negative_intense';
    return 'negative_calm';
  }

  private calculateEmotionalVariability(profile: SpeakerEmotionProfile): number {
    const { valenceRange, arousalRange } = profile.emotionalRange;

    const valenceRangeSize = valenceRange[1] - valenceRange[0];
    const arousalRangeSize = arousalRange[1] - arousalRange[0];

    return (valenceRangeSize + arousalRangeSize) / 2;
  }

  private generateEmotionRecommendations(
    profiles: SpeakerEmotionProfile[],
    highlights: EmotionalHighlight[]
  ): string[] {
    const recommendations = [];

    // Check for high negative emotions
    const negativeHighlights = highlights.filter(h => h.emotion.includes('sad') || h.emotion.includes('angr'));
    if (negativeHighlights.length > 0) {
      recommendations.push('Consider addressing negative emotional peaks in content');
    }

    // Check for low emotional variability
    const lowVariabilitySpeakers = profiles.filter(p => this.calculateEmotionalVariability(p) < 0.3);
    if (lowVariabilitySpeakers.length > 0) {
      recommendations.push('Content may benefit from more emotional diversity');
    }

    // Check for high emotional intensity
    const highIntensityHighlights = highlights.filter(h => h.intensity > 0.8);
    if (highIntensityHighlights.length > 3) {
      recommendations.push('High emotional intensity detected - ensure appropriate pacing');
    }

    return recommendations;
  }
}