import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import './TranscriptDisplay.css';

export interface TranscriptWord {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  speaker?: string;
  metadata?: Record<string, any>;
}

export interface TranscriptSentence {
  id: string;
  words: TranscriptWord[];
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

export interface TranscriptData {
  id: string;
  language: string;
  duration: number;
  sentences: TranscriptSentence[];
  speakers: string[];
  metadata?: Record<string, any>;
}

interface TranscriptDisplayProps {
  transcript: TranscriptData;
  currentTime: number;
  playbackRate: number;
  isPlaying: boolean;
  highlightedWords: string[];
  searchResults: TranscriptWord[];
  onWordClick: (word: TranscriptWord) => void;
  onTimeChange: (time: number) => void;
  onWordSelect: (wordId: string) => void;
  onSearch: (query: string) => void;
  className?: string;
  autoScroll?: boolean;
  showSpeakers?: boolean;
  showConfidence?: boolean;
  fontSize?: 'small' | 'medium' | 'large';
  theme?: 'light' | 'dark';
}

const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  transcript,
  currentTime,
  playbackRate,
  isPlaying,
  highlightedWords,
  searchResults,
  onWordClick,
  onTimeChange,
  onWordSelect,
  onSearch,
  className = '',
  autoScroll = true,
  showSpeakers = true,
  showConfidence = false,
  fontSize = 'medium',
  theme = 'dark',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Font size mappings
  const fontSizeClasses = {
    small: 'transcript-text-small',
    medium: 'transcript-text-medium',
    large: 'transcript-text-large',
  };

  // Flatten all words for easier processing
  const allWords = useMemo(() => {
    const words: (TranscriptWord & { sentenceId: string })[] = [];
    transcript.sentences.forEach(sentence => {
      sentence.words.forEach(word => {
        words.push({ ...word, sentenceId: sentence.id });
      });
    });
    return words;
  }, [transcript.sentences]);

  // Find current word based on playback time
  const currentWord = useMemo(() => {
    return allWords.find(word =>
      currentTime >= word.startTime && currentTime <= word.endTime
    );
  }, [allWords, currentTime]);

  // Auto-scroll to current word
  useEffect(() => {
    if (autoScroll && currentWord && containerRef.current) {
      const wordElement = containerRef.current.querySelector(`[data-word-id="${currentWord.id}"]`);
      if (wordElement) {
        wordElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [currentWord, autoScroll]);

  // Handle word click
  const handleWordClick = useCallback((word: TranscriptWord & { sentenceId: string }) => {
    onWordClick(word);
    onTimeChange(word.startTime);
    setSelectedWordId(word.id);
  }, [onWordClick, onTimeChange]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    onSearch(query);
  }, [onSearch]);

  // Group words by speaker
  const wordsBySpeaker = useMemo(() => {
    const grouped: Record<string, (TranscriptWord & { sentenceId: string })[]> = {};
    allWords.forEach(word => {
      const speaker = word.speaker || 'Unknown';
      if (!grouped[speaker]) {
        grouped[speaker] = [];
      }
      grouped[speaker].push(word);
    });
    return grouped;
  }, [allWords]);

  return (
    <div className={`transcript-display ${theme} ${className}`}>
      {/* Search Bar */}
      <div className="transcript-controls">
        <div className="transcript-search">
          <input
            type="text"
            placeholder="Search transcript..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="transcript-search-input"
          />
          <button
            className="transcript-search-toggle"
            onClick={() => setShowSearch(!showSearch)}
          >
            🔍
          </button>
        </div>

        <div className="transcript-settings">
          <label>
            <input
              type="checkbox"
              checked={showSpeakers}
              onChange={(e) => {/* implement speaker toggle */}}
            />
            Show Speakers
          </label>
          <label>
            <input
              type="checkbox"
              checked={showConfidence}
              onChange={(e) => {/* implement confidence toggle */}}
            />
            Show Confidence
          </label>
        </div>
      </div>

      {/* Transcript Content */}
      <div
        ref={containerRef}
        className={`transcript-content ${fontSizeClasses[fontSize]}`}
      >
        {transcript.sentences.map((sentence) => (
          <div
            key={sentence.id}
            className={`transcript-sentence ${sentence.speaker ? `speaker-${sentence.speaker}` : ''}`}
          >
            {/* Speaker Label */}
            {showSpeakers && sentence.speaker && (
              <div className="transcript-speaker-label">
                {sentence.speaker}:
              </div>
            )}

            {/* Sentence Words */}
            <div className="transcript-sentence-content">
              {sentence.words.map((word) => {
                const isCurrent = currentWord?.id === word.id;
                const isHighlighted = highlightedWords.includes(word.id);
                const isSearchResult = searchResults.some(w => w.id === word.id);
                const isSelected = selectedWordId === word.id;

                return (
                  <span
                    key={word.id}
                    data-word-id={word.id}
                    className={`
                      transcript-word
                      ${isCurrent ? 'current' : ''}
                      ${isHighlighted ? 'highlighted' : ''}
                      ${isSearchResult ? 'search-result' : ''}
                      ${isSelected ? 'selected' : ''}
                      ${word.confidence < 0.8 ? 'low-confidence' : ''}
                    `}
                    style={{
                      backgroundColor: isCurrent ? 'rgba(74, 144, 226, 0.3)' : 'transparent',
                      border: isHighlighted ? '1px solid #ffd700' : 'none',
                    }}
                    onClick={() => handleWordClick({ ...word, sentenceId: sentence.id })}
                    onDoubleClick={() => onWordSelect(word.id)}
                    title={
                      showConfidence
                        ? `Confidence: ${(word.confidence * 100).toFixed(1)}%`
                        : word.text
                    }
                  >
                    {word.text}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Current Word Indicator */}
      {currentWord && (
        <div className="transcript-current-indicator">
          <div className="current-word-info">
            <span className="current-word-text">"{currentWord.text}"</span>
            <span className="current-word-time">
              {currentWord.startTime.toFixed(2)}s - {currentWord.endTime.toFixed(2)}s
            </span>
            {currentWord.speaker && (
              <span className="current-word-speaker">Speaker: {currentWord.speaker}</span>
            )}
          </div>
        </div>
      )}

      {/* Search Results Summary */}
      {searchQuery && (
        <div className="transcript-search-summary">
          Found {searchResults.length} results for "{searchQuery}"
        </div>
      )}

      {/* Transcript Statistics */}
      <div className="transcript-stats">
        <div className="stat-item">
          <span className="stat-label">Words:</span>
          <span className="stat-value">{allWords.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Sentences:</span>
          <span className="stat-value">{transcript.sentences.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Speakers:</span>
          <span className="stat-value">{transcript.speakers.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Duration:</span>
          <span className="stat-value">{transcript.duration.toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
};

export default TranscriptDisplay;