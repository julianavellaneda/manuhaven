# Performance Test Results

**Date:** 2026-04-02
**Environment:** Local dev (macOS, bun runtime)
**Fixture:** 104,469-word Tiptap JSON document (20 chapters, ~0.94 MB)

## Results

| Test | Threshold | Actual | Status |
|---|---|---|---|
| `splitIntoChapters` on 100K-word doc | < 2000ms | 3.0ms | PASS |
| Split produces exactly 20 chapters | 20 | 20 | PASS |
| Total word count ~100K (within 10%) | 90K–110K | 104,469 | PASS |
| `mergeChapters` round-trip fidelity | exact match | exact match | PASS |
| Single chapter extraction | < 500ms | 3.2ms | PASS |
| `buildChapterSummary` correct titles | all "Chapter N" | all correct | PASS |
| Summary word counts match chapters | exact match | exact match | PASS |

**Total test duration:** 34ms (7 tests)

## Summary

All chapter utility functions perform well within thresholds on a 100K-word manuscript. `splitIntoChapters` completes in ~3ms (660x under the 2000ms threshold), confirming the chapter-based lazy loading approach will handle full-length novels without perceptible delay. Round-trip fidelity (split then merge) is exact, meaning no data is lost during chapter extraction.
