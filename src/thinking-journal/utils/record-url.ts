import { resolvePlatformById } from '../../platforms';
import type { LearningCycleRecord } from '../../shared/types';

export function resolveLearningCycleRecordUrl(record: LearningCycleRecord): string | undefined {
  const recordUrl = record.url?.trim();
  if (recordUrl) return recordUrl;

  const platform = resolvePlatformById(record.platform);
  if (!platform?.isConcreteThreadId(record.threadId)) return undefined;

  const host = platform.hosts[0];
  if (!host) return undefined;
  return `https://${host}${record.threadId}`;
}
