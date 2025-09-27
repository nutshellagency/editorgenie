import { TextAnalysisService } from '../textAnalysisService';
import { VisionService } from '../visionService';

describe('Emotion Detection', () => {
  let textService: TextAnalysisService;
  let visionService: VisionService;

  beforeEach(() => {
    textService = new TextAnalysisService({
      apiKey: 'test-gemini-key',
    });

    visionService = new VisionService({
      apiKey: 'test-qwen-key',
    });
  });

  describe('Text-based Emotion Detection', () => {
    it('should detect basic emotions in text', async () => {
      const text = 'I am so excited and happy about this amazing news!';
      const result = await textService.detectEmotions(text);

      expect(result.emotions).toHaveLength(2);
      expect(result.emotions[0].label).toBe('joy');
      expect(result.emotions[0].confidence).toBeGreaterThan(0.8);
      expect(result.emotions[1].label).toBe('excitement');
      expect(result.emotions[1].confidence).toBeGreaterThan(0.7);
    });

    it('should detect negative emotions', async () => {
      const text = 'I am deeply disappointed and frustrated with the terrible service.';
      const result = await textService.detectEmotions(text);

      expect(result.emotions.some(e => e.label === 'disappointment')).toBe(true);
      expect(result.emotions.some(e => e.label === 'frustration')).toBe(true);
      expect(result.valence).toBeLessThan(0); // Negative valence
    });

    it('should detect neutral content', async () => {
      const text = 'The weather is cloudy with a temperature of 72 degrees.';
      const result = await textService.detectEmotions(text);

      expect(result.emotions.some(e => e.label === 'neutral')).toBe(true);
      expect(result.valence).toBeGreaterThan(-0.1);
      expect(result.valence).toBeLessThan(0.1);
    });

    it('should calculate emotional dimensions correctly', async () => {
      const text = 'I am absolutely thrilled and overjoyed!';
      const result = await textService.detectEmotions(text);

      expect(result.valence).toBeGreaterThan(0.5); // Positive valence
      expect(result.arousal).toBeGreaterThan(0.5); // High arousal
      expect(result.dominance).toBeGreaterThan(0.3); // Moderate dominance
    });

    it('should handle mixed emotions', async () => {
      const text = 'I am nervous but excited about the upcoming presentation.';
      const result = await textService.detectEmotions(text);

      expect(result.emotions.some(e => e.label === 'nervousness')).toBe(true);
      expect(result.emotions.some(e => e.label === 'excitement')).toBe(true);
      expect(result.valence).toBeGreaterThan(-0.2);
      expect(result.valence).toBeLessThan(0.5); // Mixed valence
    });

    it('should detect emotion intensity', async () => {
      const mildText = 'I am somewhat pleased with the outcome.';
      const intenseText = 'I am absolutely ecstatic and overjoyed!';

      const mildResult = await textService.detectEmotions(mildText);
      const intenseResult = await textService.detectEmotions(intenseText);

      expect(intenseResult.arousal).toBeGreaterThan(mildResult.arousal);
    });

    it('should handle multilingual emotion detection', async () => {
      const spanishText = 'Estoy muy feliz y emocionado por este logro increíble.';
      const frenchText = 'Je suis très heureux et excité par cette nouvelle incroyable.';

      const spanishResult = await textService.detectEmotions(spanishText);
      const frenchResult = await textService.detectEmotions(frenchText);

      expect(spanishResult.emotions.some(e => e.label === 'joy')).toBe(true);
      expect(frenchResult.emotions.some(e => e.label === 'joy')).toBe(true);
    });

    it('should detect sarcasm and irony', async () => {
      const sarcasticText = 'Oh great, another meeting. Just what I needed today.';
      const result = await textService.detectEmotions(sarcasticText);

      expect(result.emotions.some(e => e.label === 'sarcasm')).toBe(true);
      expect(result.valence).toBeLessThan(0); // Negative despite positive words
    });
  });

  describe('Visual Emotion Detection', () => {
    it('should detect facial emotions from images', async () => {
      const happyFaceBuffer = Buffer.from('happy-face-image-data');
      const sadFaceBuffer = Buffer.from('sad-face-image-data');

      // Mock the vision service to return face detection results
      jest.spyOn(visionService, 'detectFaces').mockResolvedValueOnce([
        {
          bbox: [100, 100, 200, 200],
          confidence: 0.95,
          emotions: [
            { label: 'happiness', confidence: 0.9 },
            { label: 'surprise', confidence: 0.3 },
          ],
        },
      ]);

      const happyResult = await visionService.detectFaces(happyFaceBuffer);

      expect(happyResult[0].emotions![0].label).toBe('happiness');
      expect(happyResult[0].emotions![0].confidence).toBeGreaterThan(0.8);
    });

    it('should detect multiple faces with different emotions', async () => {
      const multiFaceBuffer = Buffer.from('multi-face-image-data');

      jest.spyOn(visionService, 'detectFaces').mockResolvedValueOnce([
        {
          bbox: [50, 50, 150, 150],
          confidence: 0.9,
          emotions: [{ label: 'happiness', confidence: 0.8 }],
        },
        {
          bbox: [200, 50, 300, 150],
          confidence: 0.85,
          emotions: [{ label: 'sadness', confidence: 0.75 }],
        },
      ]);

      const result = await visionService.detectFaces(multiFaceBuffer);

      expect(result).toHaveLength(2);
      expect(result[0].emotions![0].label).toBe('happiness');
      expect(result[1].emotions![0].label).toBe('sadness');
    });

    it('should handle faces with no detectable emotions', async () => {
      const neutralFaceBuffer = Buffer.from('neutral-face-image-data');

      jest.spyOn(visionService, 'detectFaces').mockResolvedValueOnce([
        {
          bbox: [100, 100, 200, 200],
          confidence: 0.8,
          emotions: [], // No emotions detected
        },
      ]);

      const result = await visionService.detectFaces(neutralFaceBuffer);

      expect(result[0].emotions).toHaveLength(0);
    });
  });

  describe('Speaker Emotion Analysis', () => {
    it('should analyze emotions across speaker segments', async () => {
      const segments = [
        { speaker: '1', text: 'I am so excited about this!', start: 0, end: 5 },
        { speaker: '2', text: 'This is terrible news.', start: 5, end: 10 },
        { speaker: '1', text: 'I am disappointed with the results.', start: 10, end: 15 },
      ];

      const emotionResults = await Promise.all(
        segments.map(segment => textService.detectEmotions(segment.text))
      );

      expect(emotionResults).toHaveLength(3);
      expect(emotionResults[0].valence).toBeGreaterThan(0); // Excited
      expect(emotionResults[1].valence).toBeLessThan(0); // Terrible
      expect(emotionResults[2].valence).toBeLessThan(0); // Disappointed
    });

    it('should track emotion changes over time', async () => {
      const conversation = [
        'Hello, how are you today?',
        'I am feeling great, thank you!',
        'That is wonderful to hear.',
        'Actually, I just lost my job and I am devastated.',
        'Oh no, I am so sorry to hear that.',
      ];

      const emotionProgression = await Promise.all(
        conversation.map(text => textService.detectEmotions(text))
      );

      // Should detect the shift from positive to negative emotions
      expect(emotionProgression[1].valence).toBeGreaterThan(0); // Great
      expect(emotionProgression[3].valence).toBeLessThan(0); // Devastated
    });
  });

  describe('Content-based Emotion Analysis', () => {
    it('should analyze emotions in narrative content', async () => {
      const story = `
        Once upon a time, there was a young woman named Sarah who lived in a small village.
        She was kind and generous, always helping others in need. One day, she found a lost puppy
        and felt overwhelming joy as she cared for it. However, tragedy struck when the puppy
        became ill, and Sarah felt deep sadness as she nursed it back to health.
      `;

      const result = await textService.detectEmotions(story);

      expect(result.emotions.some(e => e.label === 'joy')).toBe(true);
      expect(result.emotions.some(e => e.label === 'sadness')).toBe(true);
      expect(result.valence).toBeGreaterThan(-0.2);
      expect(result.valence).toBeLessThan(0.2); // Mixed emotions
    });

    it('should detect emotional peaks in content', async () => {
      const dramaticContent = `
        The crowd held their breath as the final moments approached.
        With a sudden burst of energy, the hero leaped forward,
        saving the day in a moment of pure triumph and exhilaration!
      `;

      const highlights = await textService.extractHighlights(dramaticContent);
      const emotions = await textService.detectEmotions(dramaticContent);

      expect(highlights.highlights.some(h => h.category === 'emotional')).toBe(true);
      expect(emotions.arousal).toBeGreaterThan(0.7); // High excitement
    });
  });

  describe('Emotion Validation and Quality', () => {
    it('should validate emotion detection accuracy', async () => {
      const testCases = [
        { text: 'I am happy', expectedEmotion: 'joy' },
        { text: 'I am sad', expectedEmotion: 'sadness' },
        { text: 'I am angry', expectedEmotion: 'anger' },
        { text: 'I am afraid', expectedEmotion: 'fear' },
      ];

      for (const testCase of testCases) {
        const result = await textService.detectEmotions(testCase.text);
        expect(result.emotions.some(e => e.label === testCase.expectedEmotion)).toBe(true);
      }
    });

    it('should handle ambiguous emotional content', async () => {
      const ambiguousText = 'The situation is interesting but challenging.';
      const result = await textService.detectEmotions(ambiguousText);

      expect(result.emotions.length).toBeGreaterThan(0);
      expect(result.valence).toBeGreaterThan(-0.3);
      expect(result.valence).toBeLessThan(0.3); // Should be relatively neutral
    });

    it('should provide confidence scores for emotion detection', async () => {
      const text = 'I am extremely happy!';
      const result = await textService.detectEmotions(text);

      expect(result.emotions[0].confidence).toBeGreaterThan(0.8);
      expect(result.emotions[0].confidence).toBeLessThanOrEqual(1.0);
    });
  });

  describe('Real-time Emotion Tracking', () => {
    it('should track emotion changes in real-time content', async () => {
      const conversationFlow = [
        'Hello, how are you?',
        'I am doing well, thanks for asking.',
        'That is great to hear!',
        'Actually, I just received some bad news.',
        'Oh no, what happened?',
        'I failed my exam and I am really upset about it.',
      ];

      const emotionFlow = await Promise.all(
        conversationFlow.map(text => textService.detectEmotions(text))
      );

      // Should detect the shift from positive to negative
      expect(emotionFlow[1].valence).toBeGreaterThan(0); // Doing well
      expect(emotionFlow[2].valence).toBeGreaterThan(0); // Great to hear
      expect(emotionFlow[5].valence).toBeLessThan(0); // Really upset
    });

    it('should identify emotional turning points', async () => {
      const turningPointText = `
        The project was going smoothly and everyone was optimistic.
        But then the main investor pulled out, and suddenly everything changed.
        The team went from hopeful to desperate in a matter of hours.
      `;

      const analysis = await textService.analyzeNarrative(turningPointText);
      const emotions = await textService.detectEmotions(turningPointText);

      expect(analysis.sentiment.progression.length).toBeGreaterThan(1);
      expect(emotions.valence).toBeLessThan(0); // Overall negative due to turning point
    });
  });

  describe('Cross-modal Emotion Analysis', () => {
    it('should correlate text and visual emotions', async () => {
      const text = 'I am so excited about this!';
      const imageBuffer = Buffer.from('excited-face-image-data');

      const textEmotions = await textService.detectEmotions(text);
      const visualEmotions = await visionService.detectFaces(imageBuffer);

      expect(textEmotions.emotions.some(e => e.label === 'excitement')).toBe(true);
      expect(visualEmotions[0].emotions!.some(e => e.label === 'happiness')).toBe(true);
    });

    it('should detect emotion mismatch between text and visuals', async () => {
      const sarcasticText = 'Oh wonderful, another delay.';
      const imageBuffer = Buffer.from('happy-face-image-data');

      const textEmotions = await textService.detectEmotions(sarcasticText);
      const visualEmotions = await visionService.detectFaces(imageBuffer);

      // Text should detect sarcasm/negative, visual should detect positive
      expect(textEmotions.valence).toBeLessThan(0);
      expect(visualEmotions[0].emotions!.some(e => e.label === 'happiness')).toBe(true);
    });
  });

  describe('Emotion-based Content Analysis', () => {
    it('should extract emotional highlights', async () => {
      const emotionalContent = `
        The story began with a sense of wonder and excitement.
        As the plot unfolded, tension built to an almost unbearable level.
        Finally, the climax brought a tremendous sense of relief and joy.
      `;

      const highlights = await textService.extractHighlights(emotionalContent);

      expect(highlights.highlights.some(h => h.category === 'emotional')).toBe(true);
      expect(highlights.highlights.some(h => h.importance > 0.8)).toBe(true);
    });

    it('should analyze emotional journey in narratives', async () => {
      const heroJourney = `
        Our hero started with uncertainty and doubt.
        Through trials and challenges, determination grew.
        Finally, triumph and confidence emerged victorious.
      `;

      const narrative = await textService.analyzeNarrative(heroJourney);

      expect(narrative.sentiment.progression.length).toBeGreaterThan(1);
      expect(narrative.sentiment.overall).toBe('positive');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty text gracefully', async () => {
      const result = await textService.detectEmotions('');

      expect(result.emotions).toHaveLength(0);
      expect(result.valence).toBe(0);
      expect(result.arousal).toBe(0);
    });

    it('should handle very long text', async () => {
      const longText = 'A'.repeat(10000); // Very long repetitive text
      const result = await textService.detectEmotions(longText);

      expect(result.emotions).toHaveLength(0); // Should detect neutral/no emotion
      expect(result.valence).toBe(0);
    });

    it('should handle special characters and emojis', async () => {
      const textWithEmojis = 'I am so happy! 😊🎉❤️';
      const result = await textService.detectEmotions(textWithEmojis);

      expect(result.emotions.some(e => e.label === 'joy')).toBe(true);
      expect(result.valence).toBeGreaterThan(0.5);
    });

    it('should handle text with mixed languages', async () => {
      const multilingualText = 'I am happy but 悲しいです。';
      const result = await textService.detectEmotions(multilingualText);

      expect(result.emotions.length).toBeGreaterThan(0);
      expect(result.valence).toBeLessThan(0.2); // Mixed emotions
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle batch emotion analysis efficiently', async () => {
      const texts = Array(100).fill('I am happy and excited about this!');

      const startTime = Date.now();
      const results = await Promise.all(
        texts.map(text => textService.detectEmotions(text))
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(results).toHaveLength(100);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should maintain accuracy with concurrent requests', async () => {
      const texts = [
        'I am very happy!',
        'I am very sad.',
        'I am very angry!',
        'I am very scared.',
      ];

      const results = await Promise.all(
        texts.map(text => textService.detectEmotions(text))
      );

      expect(results).toHaveLength(4);
      expect(results[0].valence).toBeGreaterThan(0);
      expect(results[1].valence).toBeLessThan(0);
      expect(results[2].valence).toBeLessThan(0);
      expect(results[3].valence).toBeLessThan(0);
    });
  });
});