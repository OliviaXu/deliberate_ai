import type { LearningCycleRecord, ReflectionRecord } from './types';

export const LEARNING_CYCLES_V1_STORAGE_KEY = 'deliberate.learningCycles.v1';
export const REFLECTIONS_V1_STORAGE_KEY = 'deliberate.reflections.v1';
export const LEARNING_CYCLES_STORAGE_KEY = 'deliberate.learningCycles.v2';
export const REFLECTIONS_STORAGE_KEY = 'deliberate.reflections.v2';
export const SCHEMA_MIGRATION_STORAGE_KEY = 'deliberate.schemaMigration.v2';

interface MigrationCounts {
  input: number;
  output: number;
  dropped: number;
}

export interface SchemaMigrationV2Marker {
  completed: true;
  learningCycles: MigrationCounts;
  reflections: MigrationCounts;
}

interface ChromeLocalStorageApi {
  get(keys: string[]): Promise<Record<string, unknown>> | Record<string, unknown>;
  set(items: Record<string, unknown>): Promise<void> | void;
}

export async function migrateLocalStorageToV2(
  storage: ChromeLocalStorageApi | undefined = getChromeLocalStorage()
): Promise<void> {
  if (!storage) return;
  const stored = await storage.get([
    SCHEMA_MIGRATION_STORAGE_KEY,
    LEARNING_CYCLES_V1_STORAGE_KEY,
    REFLECTIONS_V1_STORAGE_KEY
  ]);
  if (isCompletedMarker(stored[SCHEMA_MIGRATION_STORAGE_KEY])) return;

  const rawLearningCycles = asArray(stored[LEARNING_CYCLES_V1_STORAGE_KEY]);
  const learningCycles = migrateLearningCycles(rawLearningCycles);
  const learningCycleIds = new Set(learningCycles.map((record) => record.id));
  const rawReflections = asArray(stored[REFLECTIONS_V1_STORAGE_KEY]);
  const reflections = migrateReflections(rawReflections, learningCycleIds);
  const marker: SchemaMigrationV2Marker = {
    completed: true,
    learningCycles: counts(rawLearningCycles.length, learningCycles.length),
    reflections: counts(rawReflections.length, reflections.length)
  };

  await storage.set({
    [LEARNING_CYCLES_STORAGE_KEY]: learningCycles,
    [REFLECTIONS_STORAGE_KEY]: reflections,
    [SCHEMA_MIGRATION_STORAGE_KEY]: marker
  });
  console.info('Deliberate AI local storage migration to v2 completed', marker);
}

function migrateLearningCycles(values: unknown[]): LearningCycleRecord[] {
  const records: LearningCycleRecord[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    const record = migrateLearningCycle(value);
    if (!record || ids.has(record.id)) continue;
    ids.add(record.id);
    records.push(record);
  }
  return records;
}

function migrateLearningCycle(value: unknown): LearningCycleRecord | null {
  if (!isObject(value)) return null;
  const { id, timestamp, platform, threadId, url, prompt, mode, resurfacing } = value;
  if (!isNonEmptyString(id) || !isFiniteNumber(timestamp) || !isPlatform(platform)
    || !isNonEmptyString(threadId) || typeof prompt !== 'string') return null;
  if (url !== undefined && typeof url !== 'string') return null;
  const migratedResurfacing = migrateResurfacing(resurfacing);
  if (resurfacing !== undefined && !migratedResurfacing) return null;
  const base = {
    id,
    occurredAt: timestamp,
    platform,
    threadId,
    ...(url !== undefined ? { url } : {}),
    prompt,
    ...(migratedResurfacing ? { resurfacing: migratedResurfacing } : {})
  };
  if (mode === 'delegation') return { ...base, mode };
  if (mode === 'problem_solving' && isNonBlankString(value.prediction)) {
    return { ...base, mode, startingPoint: value.prediction };
  }
  if (mode === 'learning') {
    if (value.priorKnowledgeNote === undefined) return { ...base, mode };
    if (typeof value.priorKnowledgeNote === 'string') {
      return { ...base, mode, startingPoint: value.priorKnowledgeNote };
    }
  }
  return null;
}

function migrateReflections(values: unknown[], learningCycleIds: Set<string>): ReflectionRecord[] {
  const records: ReflectionRecord[] = [];
  const ids = new Set<string>();
  for (const value of values) {
    if (!isObject(value)) continue;
    const { id, timestamp, learningCycleRecordId, status, score, notes } = value;
    if (!isNonEmptyString(id) || ids.has(id) || !isFiniteNumber(timestamp)
      || !isNonEmptyString(learningCycleRecordId) || !learningCycleIds.has(learningCycleRecordId)
      || status !== 'completed' || !isReflectionScore(score)
      || (notes !== undefined && typeof notes !== 'string')) continue;
    ids.add(id);
    records.push({
      id,
      occurredAt: timestamp,
      learningCycleId: learningCycleRecordId,
      score,
      ...(typeof notes === 'string' && notes.trim() ? { notes } : {})
    });
  }
  return records;
}

function migrateResurfacing(value: unknown): LearningCycleRecord['resurfacing'] | null | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) return null;
  const { lastSurfacedAt, suppressedAt } = value;
  if ((lastSurfacedAt !== undefined && !isFiniteNumber(lastSurfacedAt))
    || (suppressedAt !== undefined && !isFiniteNumber(suppressedAt))) return null;
  if (lastSurfacedAt === undefined && suppressedAt === undefined) return {};
  return {
    ...(lastSurfacedAt !== undefined ? { lastSurfacedAt } : {}),
    ...(suppressedAt !== undefined ? { suppressedAt } : {})
  };
}

function counts(input: number, output: number): MigrationCounts {
  return { input, output, dropped: input - output };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPlatform(value: unknown): value is LearningCycleRecord['platform'] {
  return value === 'chatgpt' || value === 'claude' || value === 'gemini';
}

function isReflectionScore(value: unknown): value is ReflectionRecord['score'] {
  return value === 0 || value === 25 || value === 50 || value === 75 || value === 100;
}

function isCompletedMarker(value: unknown): value is SchemaMigrationV2Marker {
  return isObject(value) && value.completed === true;
}

function getChromeLocalStorage(): ChromeLocalStorageApi | undefined {
  return (globalThis as { chrome?: { storage?: { local?: ChromeLocalStorageApi } } }).chrome?.storage?.local;
}
