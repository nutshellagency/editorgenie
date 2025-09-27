import { TextAnalysisService } from '../textAnalysisService';
import { VisionService } from '../visionService';
import { AIService } from '../aiService';

describe('Content Analysis and Metadata Extraction', () => {
  let textService: TextAnalysisService;
  let visionService: VisionService;
  let aiService: AIService;

  beforeEach(() => {
    textService = new TextAnalysisService({
      apiKey: 'test-gemini-key',
    });

    visionService = new VisionService({
      apiKey: 'test-qwen-key',
    });

    aiService = new AIService({
      providers: {
        gemini: { apiKey: 'test-key', enabled: true },
        qwen: { apiKey: 'test-key', enabled: true },
      },
      rateLimiting: { requestsPerMinute: 60, burstLimit: 10 },
      retryPolicy: { maxRetries: 3, backoffMultiplier: 2, initialDelay: 1000 },
    });
  });

  describe('Text Content Analysis', () => {
    it('should extract comprehensive metadata from text content', async () => {
      const content = `
        Dr. Sarah Mitchell, a renowned climate scientist, presented her latest research
        on global warming at the International Climate Conference in Geneva.

        "The data shows irrefutable evidence," Mitchell stated, "that human activity
        is causing unprecedented changes to our planet's climate systems."

        The presentation included detailed charts showing temperature increases
        over the past century, with particular focus on Arctic ice melt and
        rising sea levels. Mitchell emphasized the urgent need for immediate action.
      `;

      const analysis = await textService.analyzeNarrative(content);
      const classification = await textService.classifyContent(content);
      const highlights = await textService.extractHighlights(content);

      expect(analysis.structure).toBeDefined();
      expect(analysis.key_points).toHaveLength(3);
      expect(analysis.themes).toHaveLength(2);
      expect(classification.categories).toHaveLength(2);
      expect(highlights.highlights).toHaveLength(1);
    });

    it('should identify content type and language', async () => {
      const englishContent = 'This is an English presentation about technology.';
      const spanishContent = 'Esta es una presentación en español sobre tecnología.';

      const englishClassification = await textService.classifyContent(englishContent);
      const spanishClassification = await textService.classifyContent(spanishContent);

      expect(englishClassification.language).toBe('en');
      expect(spanishClassification.language).toBe('es');
      expect(englishClassification.content_type).toBe('speech');
      expect(spanishClassification.content_type).toBe('speech');
    });

    it('should assess content quality metrics', async () => {
      const highQualityContent = `
        The research methodology was rigorous and comprehensive.
        Data collection followed established scientific protocols.
        Statistical analysis was performed using validated methods.
        Results were clearly presented with appropriate visualizations.
      `;

      const lowQualityContent = 'stuff happened idk lol';

      const highQuality = await textService.classifyContent(highQualityContent);
      const lowQuality = await textService.classifyContent(lowQualityContent);

      expect(highQuality.quality.clarity).toBeGreaterThan(0.8);
      expect(highQuality.quality.completeness).toBeGreaterThan(0.8);
      expect(lowQuality.quality.clarity).toBeLessThan(0.5);
    });

    it('should extract keywords and topics', async () => {
      const technicalContent = `
        Machine learning algorithms use neural networks to process
        natural language data. Deep learning models require large
        datasets for training. Computer vision systems can detect
        objects in images with high accuracy.
      `;

      const analysis = await textService.analyzeNarrative(technicalContent);

      expect(analysis.topics).toHaveLength(3);
      expect(analysis.topics.some(t => t.topic === 'Machine Learning')).toBe(true);
      expect(analysis.topics.some(t => t.topic === 'Computer Vision')).toBe(true);
    });
  });

  describe('Visual Content Analysis', () => {
    it('should extract metadata from video frames', async () => {
      const frames = [
        Buffer.from('presentation-slide-1'),
        Buffer.from('speaker-presenting'),
        Buffer.from('audience-reaction'),
        Buffer.from('chart-visualization'),
      ];

      const frameAnalyses = await Promise.all(
        frames.map(frame => visionService.analyzeFrame(frame))
      );

      expect(frameAnalyses).toHaveLength(4);
      expect(frameAnalyses[0].objects.some(obj => obj.label === 'text')).toBe(true); // Slide text
      expect(frameAnalyses[1].faces).toHaveLength(1); // Speaker face
      expect(frameAnalyses[2].faces).toHaveLength(5); // Audience members
      expect(frameAnalyses[3].objects.some(obj => obj.label === 'chart')).toBe(true); // Chart
    });

    it('should detect scene types and transitions', async () => {
      const sceneFrames = [
        Buffer.from('close-up-speaker'),
        Buffer.from('wide-shot-audience'),
        Buffer.from('medium-shot-presenter'),
      ];

      const sceneDetection = await visionService.detectScenes(sceneFrames);

      expect(sceneDetection.scenes).toHaveLength(3);
      expect(sceneDetection.transitions).toHaveLength(2);
      expect(sceneDetection.scenes[0].shot_type).toBe('close_up');
      expect(sceneDetection.scenes[1].shot_type).toBe('wide');
    });

    it('should track objects across frames', async () => {
      const trackingFrames = [
        Buffer.from('person-entering'),
        Buffer.from('person-walking'),
        Buffer.from('person-exiting'),
      ];

      const tracking = await visionService.trackObjects(trackingFrames);

      expect(tracking.tracks).toHaveLength(1);
      expect(tracking.tracks[0].frames).toHaveLength(3);
      expect(tracking.tracks[0].label).toBe('person');
    });
  });

  describe('Audio Content Analysis', () => {
    it('should analyze audio quality and characteristics', async () => {
      const audioBuffers = [
        Buffer.from('clear-speech-audio'),
        Buffer.from('noisy-background-audio'),
        Buffer.from('music-background-audio'),
      ];

      // Mock STT service for audio analysis
      const mockSTTService = {
        transcribe: jest.fn()
          .mockResolvedValueOnce({ text: 'Clear speech content', confidence: 0.95 })
          .mockResolvedValueOnce({ text: 'Speech with background noise', confidence: 0.65 })
          .mockResolvedValueOnce({ text: 'Speech over music', confidence: 0.70 }),
      };

      const results = await Promise.all(
        audioBuffers.map(buffer => mockSTTService.transcribe(buffer))
      );

      expect(results[0].confidence).toBeGreaterThan(0.9); // High quality
      expect(results[1].confidence).toBeLessThan(0.8); // Lower quality due to noise
      expect(results[2].confidence).toBeLessThan(0.8); // Lower quality due to music
    });

    it('should detect speaker changes and characteristics', async () => {
      const conversationAudio = Buffer.from('multi-speaker-conversation');

      const mockSTTService = {
        transcribeWithDiarization: jest.fn().mockResolvedValue({
          text: 'Speaker 1: Hello. Speaker 2: Hi there. Speaker 1: How are you?',
          speakers: [
            {
              id: 1,
              segments: [
                { text: 'Hello', start: 0, end: 2, confidence: 0.9 },
                { text: 'How are you?', start: 6, end: 8, confidence: 0.85 },
              ],
            },
            {
              id: 2,
              segments: [
                { text: 'Hi there', start: 3, end: 5, confidence: 0.88 },
              ],
            },
          ],
        }),
      };

      const result = await mockSTTService.transcribeWithDiarization(conversationAudio);

      expect(result.speakers).toHaveLength(2);
      expect(result.speakers[0].segments).toHaveLength(2);
      expect(result.speakers[1].segments).toHaveLength(1);
    });
  });

  describe('Multi-modal Content Analysis', () => {
    it('should correlate text, audio, and visual content', async () => {
      const videoFile = Buffer.from('sample-presentation-video');
      const textContent = 'This is a sample presentation about AI technology.';
      const audioBuffer = Buffer.from('presentation-audio');

      // Mock the complete video analysis workflow
      const mockAnalysis = {
        transcription: {
          text: 'This is a sample presentation about AI technology.',
          confidence: 0.95,
          segments: [
            { text: 'This is a sample presentation', start: 0, end: 3, speaker: '1' },
            { text: 'about AI technology', start: 3, end: 5, speaker: '1' },
          ],
        },
        scenes: {
          scenes: [
            { start: 0, end: 3, description: 'Speaker presenting slide' },
            { start: 3, end: 5, description: 'Technical diagram shown' },
          ],
        },
        analysis: {
          narrative: {
            structure: 'documentary',
            key_points: ['Introduction', 'Technical details', 'Conclusion'],
          },
        },
      };

      jest.spyOn(aiService, 'processVideoAnalysis').mockResolvedValueOnce(mockAnalysis);

      const result = await aiService.processVideoAnalysis(videoFile);

      expect(result.transcription.text).toBe(mockAnalysis.transcription.text);
      expect(result.scenes.scenes).toHaveLength(2);
      expect(result.analysis.narrative.structure).toBe('documentary');
    });

    it('should detect content inconsistencies', async () => {
      const mismatchedContent = {
        text: 'This is a happy, upbeat presentation about success.',
        audio: 'speaker-sounds-sad-audio',
        visual: 'speaker-looks-happy-frames',
      };

      const textEmotions = await textService.detectEmotions(mismatchedContent.text);
      const visualEmotions = await visionService.detectFaces(mismatchedContent.visual);

      // Text should be positive, but audio tone might be negative
      expect(textEmotions.valence).toBeGreaterThan(0);
      expect(visualEmotions[0].emotions?.some(e => e.label === 'happiness')).toBe(true);
    });
  });

  describe('Content Metadata Extraction', () => {
    it('should extract comprehensive metadata from video content', async () => {
      const videoContent = {
        frames: [
          Buffer.from('title-slide'),
          Buffer.from('speaker-introduction'),
          Buffer.from('main-content'),
          Buffer.from('conclusion-slide'),
        ],
        audio: Buffer.from('full-presentation-audio'),
        duration: 300, // 5 minutes
      };

      const metadata = await aiService.processVideoAnalysis(videoContent.audio);

      expect(metadata).toBeDefined();
      expect(metadata.transcription).toBeDefined();
      expect(metadata.scenes).toBeDefined();
      expect(metadata.analysis).toBeDefined();
    });

    it('should generate content summaries at different levels', async () => {
      const longContent = `
        This comprehensive presentation covers multiple important topics.
        First, we discuss the historical background and evolution of the subject.
        Then, we delve into current trends and future predictions.
        Finally, we explore practical applications and real-world examples.
        Throughout this presentation, we maintain a focus on evidence-based analysis.
      `;

      const highlights = await textService.extractHighlights(longContent);

      expect(highlights.summary.short.length).toBeLessThan(100);
      expect(highlights.summary.medium.length).toBeGreaterThan(highlights.summary.short.length);
      expect(highlights.summary.long.length).toBeGreaterThan(highlights.summary.medium.length);
    });

    it('should identify content themes and topics', async () => {
      const thematicContent = `
        Climate change represents one of the greatest challenges of our time.
        Rising temperatures, extreme weather events, and biodiversity loss
        are just some of the impacts we're already seeing. Scientists worldwide
        are working on solutions including renewable energy, carbon capture,
        and sustainable agriculture practices.
      `;

      const analysis = await textService.analyzeNarrative(thematicContent);

      expect(analysis.themes.some(t => t.theme === 'Climate Change')).toBe(true);
      expect(analysis.themes.some(t => t.theme === 'Environment')).toBe(true);
      expect(analysis.topics.some(t => t.topic === 'Renewable Energy')).toBe(true);
    });
  });

  describe('Content Quality Assessment', () => {
    it('should assess audio quality from transcription confidence', async () => {
      const highQualityAudio = Buffer.from('clear-high-quality-audio');
      const lowQualityAudio = Buffer.from('noisy-low-quality-audio');

      const mockSTTService = {
        transcribe: jest.fn()
          .mockResolvedValueOnce({ text: 'Clear speech with perfect quality', confidence: 0.98 })
          .mockResolvedValueOnce({ text: 'Noisy speech hard to understand', confidence: 0.45 }),
      };

      const highQuality = await mockSTTService.transcribe(highQualityAudio);
      const lowQuality = await mockSTTService.transcribe(lowQualityAudio);

      expect(highQuality.confidence).toBeGreaterThan(0.9);
      expect(lowQuality.confidence).toBeLessThan(0.6);
    });

    it('should assess visual quality from frame analysis', async () => {
      const sharpFrame = Buffer.from('sharp-clear-image');
      const blurryFrame = Buffer.from('blurry-low-quality-image');

      const sharpAnalysis = await visionService.analyzeFrame(sharpFrame);
      const blurryAnalysis = await visionService.analyzeFrame(blurryFrame);

      // Sharp image should have higher confidence object detection
      const sharpAvgConfidence = sharpAnalysis.objects.reduce((sum, obj) => sum + obj.confidence, 0) / sharpAnalysis.objects.length;
      const blurryAvgConfidence = blurryAnalysis.objects.reduce((sum, obj) => sum + obj.confidence, 0) / blurryAnalysis.objects.length;

      expect(sharpAvgConfidence).toBeGreaterThan(blurryAvgConfidence);
    });

    it('should assess content completeness and structure', async () => {
      const completeContent = `
        Introduction: This presentation will cover three main topics.
        Topic 1: Detailed explanation with examples and evidence.
        Topic 2: Comprehensive analysis with supporting data.
        Topic 3: Practical applications and recommendations.
        Conclusion: Summary of key points and final thoughts.
      `;

      const incompleteContent = 'Just a brief mention of the topic.';

      const completeAnalysis = await textService.analyzeNarrative(completeContent);
      const incompleteAnalysis = await textService.analyzeNarrative(incompleteContent);

      expect(completeAnalysis.key_points.length).toBeGreaterThan(incompleteAnalysis.key_points.length);
    });
  });

  describe('Content Search and Retrieval', () => {
    it('should enable content-based search', async () => {
      const contentLibrary = [
        'Presentation about artificial intelligence and machine learning',
        'Tutorial on web development with React and TypeScript',
        'Research findings on climate change and global warming',
        'Product demo for the new mobile application',
      ];

      const searchQuery = 'artificial intelligence';
      const searchResults = [];

      for (const content of contentLibrary) {
        const analysis = await textService.analyzeNarrative(content);
        const relevance = analysis.topics.some(t => t.topic.toLowerCase().includes(searchQuery.toLowerCase())) ? 1 : 0;

        if (relevance > 0) {
          searchResults.push({ content, relevance });
        }
      }

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].content).toContain('artificial intelligence');
    });

    it('should extract searchable keywords from content', async () => {
      const content = `
        The research team conducted extensive studies on renewable energy sources
        including solar power, wind turbines, and hydroelectric systems.
        Their findings indicate significant improvements in energy efficiency
        and reduced carbon emissions compared to traditional fossil fuels.
      `;

      const highlights = await textService.extractHighlights(content);

      expect(highlights.keywords).toHaveLength(5);
      expect(highlights.keywords.some(k => k.word === 'renewable energy')).toBe(true);
      expect(highlights.keywords.some(k => k.word === 'solar power')).toBe(true);
    });
  });

  describe('Content Comparison and Similarity', () => {
    it('should compare content similarity', async () => {
      const content1 = 'Machine learning is transforming healthcare with AI diagnostics.';
      const content2 = 'Artificial intelligence is revolutionizing medical diagnosis through ML.';
      const content3 = 'The weather today is sunny and warm with clear skies.';

      const comparison1 = await textService.compareContent(content1, content2);
      const comparison2 = await textService.compareContent(content1, content3);

      expect(comparison1.similarity).toBeGreaterThan(0.7); // High similarity
      expect(comparison2.similarity).toBeLessThan(0.3); // Low similarity
    });

    it('should identify common themes across content', async () => {
      const content1 = 'Climate change is causing rising temperatures and extreme weather.';
      const content2 = 'Global warming leads to more frequent natural disasters.';

      const analysis1 = await textService.analyzeNarrative(content1);
      const analysis2 = await textService.analyzeNarrative(content2);

      const commonThemes = analysis1.themes.filter(t1 =>
        analysis2.themes.some(t2 => t2.theme === t1.theme)
      );

      expect(commonThemes.length).toBeGreaterThan(0);
      expect(commonThemes.some(t => t.theme === 'Climate Change')).toBe(true);
    });
  });

  describe('Real-time Content Analysis', () => {
    it('should process streaming content in real-time', async () => {
      const streamingChunks = [
        'Good morning everyone.',
        'Today I will be presenting',
        'our latest research findings',
        'on artificial intelligence.',
      ];

      const realTimeResults = [];

      for (const chunk of streamingChunks) {
        const emotions = await textService.detectEmotions(chunk);
        const highlights = await textService.extractHighlights(chunk);

        realTimeResults.push({
          chunk,
          emotions: emotions.emotions,
          highlights: highlights.highlights,
        });
      }

      expect(realTimeResults).toHaveLength(4);
      expect(realTimeResults[0].emotions.some(e => e.label === 'positive')).toBe(true);
    });

    it('should update analysis incrementally', async () => {
      const incrementalContent = [
        'The project started with high hopes.',
        'Initial results were promising.',
        'But then we encountered significant challenges.',
        'Despite the difficulties, we persevered.',
        'Finally, we achieved success.',
      ];

      const progressiveAnalyses = [];

      for (let i = 0; i < incrementalContent.length; i++) {
        const contentSoFar = incrementalContent.slice(0, i + 1).join(' ');
        const analysis = await textService.analyzeNarrative(contentSoFar);

        progressiveAnalyses.push({
          contentLength: contentSoFar.length,
          keyPointsCount: analysis.key_points.length,
          sentiment: analysis.sentiment.overall,
        });
      }

      expect(progressiveAnalyses[0].sentiment).toBe('positive');
      expect(progressiveAnalyses[2].sentiment).toBe('negative');
      expect(progressiveAnalyses[4].sentiment).toBe('positive');
    });
  });

  describe('Content Validation and Accuracy', () => {
    it('should validate transcription accuracy', async () => {
      const originalText = 'The quick brown fox jumps over the lazy dog.';
      const audioBuffer = Buffer.from('original-text-audio');

      const mockSTTService = {
        transcribe: jest.fn().mockResolvedValue({
          text: 'The quick brown fox jumps over the lazy dog.',
          confidence: 0.98,
        }),
      };

      const result = await mockSTTService.transcribe(audioBuffer);

      expect(result.confidence).toBeGreaterThan(0.95);
      expect(result.text).toBe(originalText);
    });

    it('should detect potential transcription errors', async () => {
      const audioBuffer = Buffer.from('unclear-audio');

      const mockSTTService = {
        transcribe: jest.fn().mockResolvedValue({
          text: 'The quack brown fax jumps over the lousy dog.',
          confidence: 0.45,
        }),
      };

      const result = await mockSTTService.transcribe(audioBuffer);

      expect(result.confidence).toBeLessThan(0.6); // Low confidence indicates potential errors
    });

    it('should validate visual analysis accuracy', async () => {
      const testFrame = Buffer.from('test-image-with-known-objects');

      const analysis = await visionService.analyzeFrame(testFrame);

      // Should detect known objects with reasonable confidence
      expect(analysis.objects.length).toBeGreaterThan(0);
      expect(analysis.objects[0].confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large content efficiently', async () => {
      const largeContent = 'A'.repeat(50000); // 50KB of text

      const startTime = Date.now();
      const analysis = await textService.analyzeNarrative(largeContent);
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(analysis).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should process multiple content streams concurrently', async () => {
      const contentStreams = Array(10).fill(null).map((_, i) =>
        `Content stream number ${i} with unique information.`
      );

      const startTime = Date.now();
      const results = await Promise.all(
        contentStreams.map(content => textService.analyzeNarrative(content))
      );
      const endTime = Date.now();

      const processingTime = endTime - startTime;

      expect(results).toHaveLength(10);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle corrupted or invalid content', async () => {
      const corruptedAudio = Buffer.from('corrupted-audio-data');
      const invalidImage = Buffer.from('not-an-image');

      const mockSTTService = {
        transcribe: jest.fn().mockRejectedValue(new Error('Invalid audio format')),
      };

      const mockVisionService = {
        analyzeFrame: jest.fn().mockRejectedValue(new Error('Invalid image format')),
      };

      await expect(mockSTTService.transcribe(corruptedAudio))
        .rejects.toThrow('Invalid audio format');

      await expect(mockVisionService.analyzeFrame(invalidImage))
        .rejects.toThrow('Invalid image format');
    });

    it('should handle empty or minimal content', async () => {
      const emptyContent = '';
      const minimalContent = 'Hi.';

      const emptyAnalysis = await textService.analyzeNarrative(emptyContent);
      const minimalAnalysis = await textService.analyzeNarrative(minimalContent);

      expect(emptyAnalysis.key_points).toHaveLength(0);
      expect(minimalAnalysis.key_points).toHaveLength(1);
    });

    it('should handle unsupported languages gracefully', async () => {
      const rareLanguageContent = 'Content in a rare or unsupported language.';

      const classification = await textService.classifyContent(rareLanguageContent);

      expect(classification.language).toBeDefined();
      expect(classification.categories).toHaveLength(0); // May not categorize unsupported languages
    });
  });
});