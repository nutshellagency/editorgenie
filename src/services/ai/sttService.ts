import { AssemblyAI } from 'assemblyai';

export interface STTConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  confidence: number;
  language?: string;
  words?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  segments?: Array<{
    text: string;
    start: number;
    end: number;
    confidence: number;
    speaker?: string;
  }>;
}

export interface DiarizationResult {
  speakers: Array<{
    id: number;
    segments: Array<{
      text: string;
      start: number;
      end: number;
      confidence: number;
    }>;
  }>;
}

export interface STTOptions {
  language?: string;
  punctuate?: boolean;
  format_text?: boolean;
  dual_channel?: boolean;
  webhook_url?: string;
  boost_param?: 'low' | 'default' | 'high';
  filter_profanity?: boolean;
}

export class STTService {
  private client: AssemblyAI;
  private config: STTConfig;

  constructor(config: STTConfig) {
    this.config = config;
    this.client = new AssemblyAI({
      apiKey: config.apiKey,
    });
  }

  async transcribe(audioBuffer: Buffer, options: STTOptions = {}): Promise<TranscriptionResult> {
    try {
      // Convert audio buffer to file for upload
      const audioFile = await this.bufferToAudioFile(audioBuffer);

      // Configure transcription
      const transcriptConfig = {
        audio_url: 'placeholder-url', // This would need to be uploaded first
        language_code: options.language || 'en',
        punctuate: options.punctuate ?? true,
        format_text: options.format_text ?? true,
        dual_channel: options.dual_channel ?? false,
        webhook_url: options.webhook_url,
        boost_param: options.boost_param || 'default',
        filter_profanity: options.filter_profanity ?? false,
      };

      // Submit transcription job
      const transcript = await this.client.transcripts.create(transcriptConfig);

      // Poll for completion
      return await this.pollTranscriptionResult(transcript.id);
    } catch (error) {
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async transcribeWithDiarization(audioBuffer: Buffer, options: STTOptions = {}): Promise<TranscriptionResult & DiarizationResult> {
    try {
      const audioFile = await this.bufferToAudioFile(audioBuffer);

      // Configure transcription with speaker diarization
      const transcriptConfig = {
        audio_url: 'placeholder-url', // This would need to be uploaded first
        language_code: options.language || 'en',
        punctuate: true,
        format_text: true,
        dual_channel: false,
        speaker_labels: true, // Enable speaker diarization
        speakers_expected: undefined, // Let AssemblyAI auto-detect
      };

      const transcript = await this.client.transcripts.create(transcriptConfig);
      const result = await this.pollTranscriptionResult(transcript.id);

      // Process speaker segments
      const speakers = this.processSpeakerSegments(result);

      return {
        ...result,
        speakers,
      };
    } catch (error) {
      throw new Error(`Transcription with diarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async diarize(audioBuffer: Buffer): Promise<DiarizationResult> {
    try {
      const result = await this.transcribeWithDiarization(audioBuffer);
      return {
        speakers: result.speakers,
      };
    } catch (error) {
      throw new Error(`Diarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTranscriptionStatus(transcriptId: string): Promise<string> {
    try {
      const transcript = await this.client.transcripts.get(transcriptId);
      return transcript.status || 'unknown';
    } catch (error) {
      throw new Error(`Failed to get transcription status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTranscriptionResult(transcriptId: string): Promise<TranscriptionResult> {
    try {
      const transcript = await this.client.transcripts.get(transcriptId);

      if (transcript.status !== 'completed') {
        throw new Error(`Transcription not completed. Status: ${transcript.status}`);
      }

      return {
        id: transcript.id,
        text: transcript.text || '',
        confidence: transcript.confidence || 0,
        language: transcript.language_code,
        words: transcript.words?.map(word => ({
          text: word.text,
          start: word.start,
          end: word.end,
          confidence: word.confidence,
        })) || [],
        segments: transcript.utterances?.map(utterance => ({
          text: utterance.text,
          start: utterance.start,
          end: utterance.end,
          confidence: utterance.confidence,
          speaker: utterance.speaker,
        })) || [],
      };
    } catch (error) {
      throw new Error(`Failed to get transcription result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async bufferToAudioFile(audioBuffer: Buffer): Promise<File> {
    // Create a File object from the buffer
    // Convert Buffer to Uint8Array for proper compatibility
    const uint8Array = new Uint8Array(audioBuffer);
    return new File([uint8Array], 'audio.wav', { type: 'audio/wav' });
  }

  private async pollTranscriptionResult(transcriptId: string, maxAttempts: number = 30): Promise<TranscriptionResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.getTranscriptionResult(transcriptId);
        return result;
      } catch (error) {
        // If transcription is not ready, wait and try again
        if (attempt < maxAttempts - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        } else {
          throw error;
        }
      }
    }

    throw new Error('Transcription polling timed out');
  }

  private processSpeakerSegments(result: TranscriptionResult): DiarizationResult['speakers'] {
    const speakerMap = new Map<number, DiarizationResult['speakers'][0]>();

    result.segments?.forEach(segment => {
      const speakerId = segment.speaker ? parseInt(segment.speaker) : 1;

      if (!speakerMap.has(speakerId)) {
        speakerMap.set(speakerId, {
          id: speakerId,
          segments: [],
        });
      }

      speakerMap.get(speakerId)!.segments.push({
        text: segment.text,
        start: segment.start,
        end: segment.end,
        confidence: segment.confidence,
      });
    });

    return Array.from(speakerMap.values());
  }

  async healthCheck(): Promise<void> {
    try {
      // Simple health check by attempting to get account info or similar
      // AssemblyAI doesn't have a direct health check endpoint, so we'll use a minimal transcription
      const testAudio = Buffer.from(''); // Empty buffer for health check
      await this.transcribe(testAudio);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Invalid API key')) {
        throw new Error('Invalid API key');
      }
      throw new Error('AssemblyAI service unavailable');
    }
  }

  getConfig(): STTConfig {
    return { ...this.config };
  }

  // Batch transcription for multiple audio files
  async transcribeBatch(audioBuffers: Buffer[], options: STTOptions = {}): Promise<TranscriptionResult[]> {
    const promises = audioBuffers.map(buffer => this.transcribe(buffer, options));
    return Promise.all(promises);
  }

  // Real-time transcription (placeholder for future implementation)
  async startRealtimeTranscription(
    audioStream: ReadableStream,
    options: STTOptions = {},
    onResult: (result: Partial<TranscriptionResult>) => void
  ): Promise<void> {
    // Placeholder for real-time transcription
    // This would require WebSocket connection to AssemblyAI's real-time API
    throw new Error('Real-time transcription not yet implemented');
  }

  // Language detection
  async detectLanguage(audioBuffer: Buffer): Promise<string> {
    try {
      const result = await this.transcribe(audioBuffer, { language: 'en' }); // Use English as base
      return result.language || 'en';
    } catch (error) {
      throw new Error(`Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Confidence scoring and quality assessment
  assessTranscriptionQuality(result: TranscriptionResult): {
    overall: 'high' | 'medium' | 'low';
    issues: string[];
  } {
    const issues: string[] = [];
    let quality: 'high' | 'medium' | 'low' = 'high';

    // Check overall confidence
    if (result.confidence < 0.7) {
      issues.push('Low overall confidence');
      quality = 'low';
    } else if (result.confidence < 0.85) {
      issues.push('Medium overall confidence');
      quality = 'medium';
    }

    // Check for missing words
    if (result.words && result.words.length === 0) {
      issues.push('No word-level timestamps');
    }

    // Check for missing segments
    if (result.segments && result.segments.length === 0) {
      issues.push('No segment information');
    }

    // Check for very short text
    if (result.text.length < 10) {
      issues.push('Very short transcription');
      quality = 'low';
    }

    return { overall: quality, issues };
  }
}