import { INTERACTION_MODES, isReflectionEligibleRecord } from '../shared/types';
import { JOURNAL_WINDOW_MS } from '../thinking-journal/journal-window';
import type {
  LearningCycleRecord,
  ReflectionEligibleLearningCycleRecord,
  ReflectionRecord,
  ResurfacingCandidate
} from '../shared/types';

export function selectResurfacingLearningCycle(
  records: LearningCycleRecord[],
  nowMs: number,
  random: () => number = Math.random
): ReflectionEligibleLearningCycleRecord | null {
  const cutoffMs = nowMs - JOURNAL_WINDOW_MS;
  const candidates = records.filter(
    (record): record is ReflectionEligibleLearningCycleRecord =>
      isReflectionEligibleRecord(record) && record.occurredAt < cutoffMs && hasStartingMaterial(record)
      && record.resurfacing?.suppressedAt === undefined
  );
  if (candidates.length === 0) return null;

  const unseen = candidates.filter((record) => record.resurfacing?.lastSurfacedAt === undefined);
  if (unseen.length > 0) return chooseRandom(unseen, random);

  const oldestPresentation = Math.min(
    ...candidates.map((record) => record.resurfacing?.lastSurfacedAt ?? Number.POSITIVE_INFINITY)
  );
  return chooseRandom(
    candidates.filter((record) => record.resurfacing?.lastSurfacedAt === oldestPresentation),
    random
  );
}

export function buildResurfacingCandidate(
  record: ReflectionEligibleLearningCycleRecord,
  reflections: ReflectionRecord[]
): ResurfacingCandidate {
  let latestWrittenReflection: ReflectionRecord | undefined;

  for (const reflection of reflections) {
    if (reflection.learningCycleId !== record.id || !reflection.notes?.trim()) continue;
    if (!latestWrittenReflection || reflection.occurredAt > latestWrittenReflection.occurredAt) {
      latestWrittenReflection = reflection;
    }
  }

  return {
    learningCycleId: record.id,
    excerpt: latestWrittenReflection?.notes ?? startingMaterial(record)
  };
}

function hasStartingMaterial(record: ReflectionEligibleLearningCycleRecord): boolean {
  return Boolean(startingMaterial(record).trim());
}

function startingMaterial(record: ReflectionEligibleLearningCycleRecord): string {
  if (record.mode === INTERACTION_MODES.PROBLEM_SOLVING) return record.startingPoint;
  return record.startingPoint ?? '';
}

function chooseRandom<T>(items: T[], random: () => number): T {
  const index = Math.min(Math.floor(random() * items.length), items.length - 1);
  return items[index]!;
}
