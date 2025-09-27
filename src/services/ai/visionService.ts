export interface VisionConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  model?: string;
}

export interface FrameAnalysis {
  objects: Array<{
    label: string;
    confidence: number;
    bbox: [number, number, number, number]; // [x1, y1, x2, y2]
    category?: string;
  }>;
  scene?: {
    description: string;
    confidence: number;
    tags: string[];
  };
  faces?: Array<{
    bbox: [number, number, number, number];
    confidence: number;
    emotions?: Array<{
      label: string;
      confidence: number;
    }>;
    age?: {
      min: number;
      max: number;
      confidence: number;
    };
    gender?: {
      label: string;
      confidence: number;
    };
  }>;
  text?: Array<{
    text: string;
    confidence: number;
    bbox: [number, number, number, number];
    language?: string;
  }>;
  colors?: Array<{
    hex: string;
    name: string;
    percentage: number;
  }>;
}

export interface SceneDetectionResult {
  scenes: Array<{
    start: number;
    end: number;
    confidence: number;
    description?: string;
    shot_type?: 'close_up' | 'medium' | 'wide' | 'extreme_wide' | 'establishing';
    movement?: 'static' | 'slow_pan' | 'fast_pan' | 'zoom_in' | 'zoom_out' | 'tracking';
  }>;
  transitions: Array<{
    timestamp: number;
    type: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'unknown';
    confidence: number;
  }>;
}

export interface ObjectTrackingResult {
  tracks: Array<{
    id: number;
    label: string;
    confidence: number;
    frames: Array<{
      frame_index: number;
      bbox: [number, number, number, number];
      confidence: number;
    }>;
  }>;
}

export interface VisionAnalysisOptions {
  includeObjects?: boolean;
  includeScene?: boolean;
  includeFaces?: boolean;
  includeText?: boolean;
  includeColors?: boolean;
  confidenceThreshold?: number;
  maxObjects?: number;
}

export class VisionService {
  private config: VisionConfig;

  constructor(config: VisionConfig) {
    this.config = config;
  }

  async analyzeFrame(imageBuffer: Buffer, options: VisionAnalysisOptions = {}): Promise<FrameAnalysis> {
    try {
      const analysis: FrameAnalysis = {
        objects: [],
        faces: [],
        text: [],
        colors: [],
      };

      // Object detection
      if (options.includeObjects !== false) {
        analysis.objects = await this.detectObjects(imageBuffer, options);
      }

      // Scene analysis
      if (options.includeScene !== false) {
        analysis.scene = await this.analyzeScene(imageBuffer);
      }

      // Face detection and analysis
      if (options.includeFaces !== false) {
        analysis.faces = await this.detectFaces(imageBuffer);
      }

      // Text detection (OCR)
      if (options.includeText !== false) {
        analysis.text = await this.detectText(imageBuffer);
      }

      // Color analysis
      if (options.includeColors !== false) {
        analysis.colors = await this.extractColors(imageBuffer);
      }

      return analysis;
    } catch (error) {
      throw new Error(`Frame analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectObjects(imageBuffer: Buffer, options: VisionAnalysisOptions = {}): Promise<FrameAnalysis['objects']> {
    try {
      // Qwen Vision object detection implementation
      const objects = await this.callQwenVisionAPI(imageBuffer, 'object_detection');

      // Filter by confidence threshold
      const threshold = options.confidenceThreshold || 0.5;
      let filteredObjects = objects.filter((obj: any) => obj.confidence >= threshold);

      // Limit number of objects
      if (options.maxObjects && filteredObjects.length > options.maxObjects) {
        filteredObjects = filteredObjects
          .sort((a: any, b: any) => b.confidence - a.confidence)
          .slice(0, options.maxObjects);
      }

      return filteredObjects;
    } catch (error) {
      throw new Error(`Object detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async detectScenes(frames: Buffer[]): Promise<SceneDetectionResult> {
    try {
      const scenes: SceneDetectionResult['scenes'] = [];
      const transitions: SceneDetectionResult['transitions'] = [];

      // Analyze each frame for scene changes
      for (let i = 0; i < frames.length; i++) {
        const frameAnalysis = await this.analyzeFrame(frames[i], { includeScene: true });

        if (frameAnalysis.scene) {
          // Determine shot type based on object positions and sizes
          const shotType = this.determineShotType(frameAnalysis);

          // Detect movement by comparing with previous frame
          const movement = i > 0 ? await this.detectMovement(frames[i - 1], frames[i]) : 'static';

          scenes.push({
            start: i,
            end: i + 1,
            confidence: frameAnalysis.scene.confidence,
            description: frameAnalysis.scene.description,
            shot_type: shotType,
            movement: movement,
          });
        }

        // Detect transitions between frames
        if (i > 0) {
          const transition = await this.detectTransition(frames[i - 1], frames[i]);
          if (transition) {
            transitions.push({
              timestamp: i,
              type: transition.type,
              confidence: transition.confidence,
            });
          }
        }
      }

      return { scenes, transitions };
    } catch (error) {
      throw new Error(`Scene detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async trackObjects(frames: Buffer[], objectIds?: number[]): Promise<ObjectTrackingResult> {
    try {
      const tracks: ObjectTrackingResult['tracks'] = [];

      // Initialize tracking for each frame
      for (let i = 0; i < frames.length; i++) {
        const frameAnalysis = await this.analyzeFrame(frames[i], { includeObjects: true });

        frameAnalysis.objects.forEach((obj, objIndex) => {
          const trackId = objectIds ? objectIds[objIndex] : objIndex;

          if (!tracks[trackId]) {
            tracks[trackId] = {
              id: trackId,
              label: obj.label,
              confidence: obj.confidence,
              frames: [],
            };
          }

          tracks[trackId].frames.push({
            frame_index: i,
            bbox: obj.bbox,
            confidence: obj.confidence,
          });
        });
      }

      return { tracks };
    } catch (error) {
      throw new Error(`Object tracking failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async detectFaces(imageBuffer: Buffer): Promise<FrameAnalysis['faces']> {
    try {
      const faces = await this.callQwenVisionAPI(imageBuffer, 'face_detection');

      // Enhance face analysis with emotion detection
      const enhancedFaces = await Promise.all(
        faces.map(async (face: any) => {
          const emotions = await this.detectFaceEmotions(imageBuffer, face.bbox);
          const demographics = await this.analyzeFaceDemographics(imageBuffer, face.bbox);

          return {
            bbox: face.bbox,
            confidence: face.confidence,
            emotions,
            ...demographics,
          };
        })
      );

      return enhancedFaces;
    } catch (error) {
      throw new Error(`Face detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async detectText(imageBuffer: Buffer): Promise<FrameAnalysis['text']> {
    try {
      const textDetections = await this.callQwenVisionAPI(imageBuffer, 'text_detection');

      return textDetections.map((detection: any) => ({
        text: detection.text,
        confidence: detection.confidence,
        bbox: detection.bbox,
        language: detection.language,
      }));
    } catch (error) {
      throw new Error(`Text detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractColors(imageBuffer: Buffer): Promise<FrameAnalysis['colors']> {
    try {
      const colors = await this.callQwenVisionAPI(imageBuffer, 'color_analysis');

      return colors.map((color: any) => ({
        hex: color.hex,
        name: color.name,
        percentage: color.percentage,
      }));
    } catch (error) {
      throw new Error(`Color extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeScene(imageBuffer: Buffer): Promise<FrameAnalysis['scene']> {
    try {
      const sceneAnalysis = await this.callQwenVisionAPI(imageBuffer, 'scene_analysis');

      return {
        description: sceneAnalysis.description,
        confidence: sceneAnalysis.confidence,
        tags: sceneAnalysis.tags || [],
      };
    } catch (error) {
      throw new Error(`Scene analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async detectMovement(frame1: Buffer, frame2: Buffer): Promise<'static' | 'slow_pan' | 'fast_pan' | 'zoom_in' | 'zoom_out' | 'tracking'> {
    try {
      const movement = await this.callQwenVisionAPI(
        { frame1, frame2 },
        'movement_detection'
      );

      return movement.type || 'static';
    } catch (error) {
      return 'static'; // Default to static if detection fails
    }
  }

  private async detectTransition(frame1: Buffer, frame2: Buffer): Promise<{ type: 'cut' | 'fade' | 'dissolve' | 'wipe' | 'unknown'; confidence: number } | null> {
    try {
      const transition = await this.callQwenVisionAPI(
        { frame1, frame2 },
        'transition_detection'
      );

      if (transition.confidence > 0.7) {
        return {
          type: transition.type,
          confidence: transition.confidence,
        };
      }

      return null;
    } catch (error) {
      return null; // Return null if detection fails
    }
  }

  private async detectFaceEmotions(imageBuffer: Buffer, bbox: [number, number, number, number]): Promise<Array<{ label: string; confidence: number }>> {
    try {
      const emotions = await this.callQwenVisionAPI(
        { image: imageBuffer, bbox },
        'emotion_detection'
      );

      return emotions.map((emotion: any) => ({
        label: emotion.label,
        confidence: emotion.confidence,
      }));
    } catch (error) {
      return []; // Return empty array if detection fails
    }
  }

  private async analyzeFaceDemographics(imageBuffer: Buffer, bbox: [number, number, number, number]): Promise<{
    age?: { min: number; max: number; confidence: number };
    gender?: { label: string; confidence: number };
  }> {
    try {
      const demographics = await this.callQwenVisionAPI(
        { image: imageBuffer, bbox },
        'demographics_analysis'
      );

      return {
        age: demographics.age,
        gender: demographics.gender,
      };
    } catch (error) {
      return {}; // Return empty object if analysis fails
    }
  }

  private determineShotType(analysis: FrameAnalysis): 'close_up' | 'medium' | 'wide' | 'extreme_wide' | 'establishing' {
    if (!analysis.objects.length) return 'wide';

    // Analyze object positions and sizes to determine shot type
    const mainObjects = analysis.objects
      .filter(obj => obj.confidence > 0.8)
      .sort((a, b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) -
                     (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]));

    if (mainObjects.length === 0) return 'wide';

    const largestObject = mainObjects[0];
    const objectArea = (largestObject.bbox[2] - largestObject.bbox[0]) *
                      (largestObject.bbox[3] - largestObject.bbox[1]);

    // Estimate shot type based on object size relative to frame
    const frameArea = 1920 * 1080; // Assume Full HD
    const relativeSize = objectArea / frameArea;

    if (relativeSize > 0.3) return 'close_up';
    if (relativeSize > 0.15) return 'medium';
    if (relativeSize > 0.05) return 'wide';
    return 'extreme_wide';
  }

  private async callQwenVisionAPI(input: any, task: string): Promise<any> {
    try {
      // This is a placeholder for the actual Qwen Vision API integration
      // In a real implementation, this would make HTTP requests to the Qwen Vision API

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Return mock data based on task type
      switch (task) {
        case 'object_detection':
          return [
            { label: 'person', confidence: 0.95, bbox: [100, 100, 200, 300], category: 'human' },
            { label: 'car', confidence: 0.87, bbox: [300, 150, 500, 250], category: 'vehicle' },
          ];

        case 'scene_analysis':
          return {
            description: 'A person standing next to a car in a parking lot',
            confidence: 0.92,
            tags: ['person', 'car', 'parking lot', 'outdoor'],
          };

        case 'face_detection':
          return [
            { bbox: [100, 100, 200, 200], confidence: 0.95 },
          ];

        case 'text_detection':
          return [
            { text: 'Hello World', confidence: 0.90, bbox: [50, 50, 150, 80], language: 'en' },
          ];

        case 'color_analysis':
          return [
            { hex: '#FF0000', name: 'red', percentage: 45.2 },
            { hex: '#00FF00', name: 'green', percentage: 30.1 },
            { hex: '#0000FF', name: 'blue', percentage: 24.7 },
          ];

        case 'movement_detection':
          return { type: 'static' };

        case 'transition_detection':
          return { type: 'cut', confidence: 0.95 };

        case 'emotion_detection':
          return [
            { label: 'happy', confidence: 0.85 },
            { label: 'confident', confidence: 0.72 },
          ];

        case 'demographics_analysis':
          return {
            age: { min: 25, max: 35, confidence: 0.80 },
            gender: { label: 'male', confidence: 0.90 },
          };

        default:
          return {};
      }
    } catch (error) {
      throw new Error(`Qwen Vision API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async healthCheck(): Promise<void> {
    try {
      // Simple health check with a minimal image
      const testImage = Buffer.from('fake-image-data');
      await this.analyzeFrame(testImage, { includeObjects: true });
    } catch (error) {
      if (error instanceof Error && error.message.includes('API key')) {
        throw new Error('Invalid API key');
      }
      throw new Error('Qwen Vision service unavailable');
    }
  }

  getConfig(): VisionConfig {
    return { ...this.config };
  }

  // Batch processing for multiple frames
  async analyzeFramesBatch(frames: Buffer[], options: VisionAnalysisOptions = {}): Promise<FrameAnalysis[]> {
    const promises = frames.map(frame => this.analyzeFrame(frame, options));
    return Promise.all(promises);
  }

  // Video analysis with temporal consistency
  async analyzeVideoWithTracking(
    frames: Buffer[],
    options: VisionAnalysisOptions & { enableTracking?: boolean } = {}
  ): Promise<{
    frameAnalyses: FrameAnalysis[];
    sceneDetection: SceneDetectionResult;
    objectTracking?: ObjectTrackingResult;
  }> {
    const frameAnalyses = await this.analyzeFramesBatch(frames, options);
    const sceneDetection = await this.detectScenes(frames);

    let objectTracking;
    if (options.enableTracking !== false) {
      objectTracking = await this.trackObjects(frames);
    }

    return {
      frameAnalyses,
      sceneDetection,
      objectTracking,
    };
  }
}