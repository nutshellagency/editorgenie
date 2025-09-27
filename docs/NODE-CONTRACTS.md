# Node Contract System

## Overview
Every processing node must expose well-defined input/output contracts to ensure modularity, testability, and interoperability.

## Contract Requirements

### 1. Schema Definition
Each node must define:
- **Input Schema**: JSON Schema defining required and optional inputs
- **Output Schema**: JSON Schema defining the structure of outputs
- **Configuration Schema**: JSON Schema for node-specific settings

### 2. Version Management
- **Node Version**: Semantic version (e.g., "1.2.3")
- **Model Versions**: Exact hashes/versions for ML models
- **Dependencies**: Version specifications for external services

### 3. Replay Manifest
Every node execution must generate a `replay_manifest.json` containing:
- Input data (or references)
- Node version and configuration
- Execution timestamp
- Output artifacts
- Performance metrics

## Node Categories

### Analysis Nodes
- **STT Node**: Speech-to-text transcription
- **ShotDetect Node**: Scene/shot boundary detection
- **Vision Node**: Object detection, OCR, emotion analysis
- **Director Node**: Timeline blueprint generation

### Processing Nodes
- **Assembly Node**: Video editing and assembly
- **Export Node**: Final video and project file generation

## Implementation Pattern

```typescript
// Example: STT Node Contract
interface STTNodeContract {
  input: {
    type: 'object';
    required: ['audio_url', 'language'];
    properties: {
      audio_url: { type: 'string' };
      language: { type: 'string'; enum: ['en', 'ur'] };
      options?: {
        diarization?: boolean;
        timestamps?: boolean;
      };
    };
  };

  output: {
    type: 'object';
    required: ['transcript', 'segments'];
    properties: {
      transcript: { type: 'string' };
      segments: {
        type: 'array';
        items: {
          type: 'object';
          properties: {
            start: { type: 'number' };
            end: { type: 'number' };
            text: { type: 'string' };
            speaker?: { type: 'string' };
          };
        };
      };
    };
  };

  config: {
    type: 'object';
    required: ['model_version'];
    properties: {
      model_version: { type: 'string' };
      api_key?: { type: 'string' };
    };
  };
}
```

## Testing Requirements

### Contract Tests
- **Schema Validation**: Ensure inputs/outputs match defined schemas
- **Version Compatibility**: Test node behavior across version changes
- **Error Handling**: Test graceful failure with invalid inputs

### Integration Tests
- **Node Chaining**: Test data flow between connected nodes
- **Error Propagation**: Test how errors flow through the pipeline
- **Performance**: Test execution time and resource usage

## Validation Rules

### Input Validation
- All required fields must be present
- Field types must match schema definitions
- Optional fields must have valid defaults

### Output Validation
- All required outputs must be generated
- Output structure must match schema
- Data integrity checks (e.g., timestamp ordering)

### Cross-Node Validation
- Output of one node must be compatible with input of next node
- Version compatibility between chained nodes
- Error boundaries between nodes

## Enforcement

### Development Time
- TypeScript interfaces for compile-time checking
- JSON Schema validation in development
- IDE plugins for contract validation

### Runtime
- Schema validation on node execution
- Contract compliance checks in CI/CD
- Automatic contract testing in test suite

### CI/CD Gates
- Contract compliance: 100% pass rate
- Schema validation tests
- Cross-node compatibility tests