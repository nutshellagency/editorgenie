# Engineering Rules & Testing Charter

## 1. Philosophy
All engineering must be **modular, test-driven, and reproducible**. Every feature is accepted only if:
- It is backed by automated tests.
- It is replayable/debuggable.
- It passes CI/CD gates (unit, integration, E2E, visual tests).

This prevents fragile builds and ensures a reliable app for all users.

---

## 2. Development Rules
- **TDD-first**: Write failing tests before implementing features.
- **Node contracts**: Every node (STT, ShotDetect, Director, Assembly, Export) must expose input/output schemas (JSON Schema or Protobuf).
- **Tests co-located**: Tests must live next to implementation code.
- **Replayable runs**: Every job must produce a `replay_manifest.json` with all inputs, node versions, and artifacts.
- **Model pinning**: ML nodes must specify exact version/hash; tests must fail if signature mismatches.

---

## 3. Testing Pyramid
- **Unit tests (60%)**: Utilities, node logic, schema validation.  
- **Integration tests (25%)**: Node-to-node flows, DB/storage.  
- **End-to-end tests (10%)**: Ingest → proxy → analysis → Director → assembly → export.  
- **Visual regression (5%)**: UI + proxy timeline snapshots.

---

## 4. Visual Testing
- **Playwright** for E2E and UI flows.  
- Visual snapshots for node graph, timeline, preview frames.  
- Use `expect().toHaveScreenshot()` with golden baselines.  
- Deterministic test env: freeze fonts, disable animations, use fixed proxies.

---

## 5. Replay/Debug Service
- Capture every job’s full state in `replay_manifest.json`.  
- Include input media (or references), node graph, node versions.  
- CLI/runner can replay any failed job deterministically.  
- Logs and traces must use **OpenTelemetry** IDs for correlation.  
- CI must support reproducing failing jobs automatically.

---

## 6. CI/CD Requirements
- CI must run on all pull requests:
  - Lint + static analysis.
  - Unit tests + contract tests.
  - Integration + E2E Playwright tests.
- PRs blocked if tests fail.
- Preview environments spun up per PR for manual QA.

---

## 7. Acceptance Gates
- **Coverage thresholds**:  
  - Backend: ≥ 85%.  
  - Frontend: ≥ 70%.  
- **Contract compliance**: 100% pass.  
- **Visual regression**: No diffs > threshold (SSIM ≥ 0.98).  
- **Replay SLA**: 100% reproducible failures.  
- **Golden dataset**: Must pass defined pipeline outputs.  

---

## 8. Security & Privacy
- No storage of raw media for training unless user opt-in.  
- All URLs must be signed and expire.  
- Redaction tests for PII in transcripts.

---

## 9. Flowchart (textual)
1. **Upload** → Ingest Node (proxy + metadata).  
2. **Analysis** → STT, ShotDetect, Vision nodes (parallel).  
3. **Director Node** → Timeline Blueprint JSON.  
4. **Timeline Preview** → Proxy video + transcripts.  
5. **Chat Instructions** → Adjust blueprint/nodes via NLP.  
6. **Assembly** → FFmpeg applies edits.  
7. **Export** → MP4 + SRT + .prproj/.drp.  
8. **Publish** → Optional direct upload.  
9. **Replay/Debug** → Manifest ensures reproducibility.

---

## 10. AI Engineer Checklist
Every task must include:
- ✅ Schema definitions.  
- ✅ Unit + integration tests.  
- ✅ Playwright UI test if applicable.  
- ✅ Replay manifest integration.  
- ✅ Coverage report.  
- ✅ Visual regression baseline (if UI-affecting).  
- ✅ Documentation update (node usage + API).  

Tasks without these will be rejected.
