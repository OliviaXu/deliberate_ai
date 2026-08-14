import type { LearningCycleStore } from '../shared/learning-cycle-store';
import type { ReflectionStore } from '../shared/reflection-store';
import { buildResurfacingCandidate, selectResurfacingLearningCycle } from './resurfacing-selection';
import type { ResurfacingCandidate } from '../shared/types';

interface ResurfacingServiceDependencies {
  learningCycleStore: Pick<LearningCycleStore, 'listAll' | 'markResurfaced' | 'setResurfacingSuppressed'>;
  reflectionStore: Pick<ReflectionStore, 'listAll'>;
  now?: () => number;
  random?: () => number;
}

export class ResurfacingService {
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly dependencies: ResurfacingServiceDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.random = dependencies.random ?? Math.random;
  }

  async presentNext(): Promise<ResurfacingCandidate | null> {
    const records = await this.dependencies.learningCycleStore.listAll();
    const presentedAt = this.now();
    const record = selectResurfacingLearningCycle(records, presentedAt, this.random);
    if (!record) return null;

    const reflections = await this.dependencies.reflectionStore.listAll();
    const candidate = buildResurfacingCandidate(record, reflections);

    const updated = await this.dependencies.learningCycleStore.markResurfaced(
      candidate.learningCycleId,
      presentedAt
    );
    return updated ? candidate : null;
  }

  async setSuppressed(recordId: string, suppressed: boolean): Promise<void> {
    await this.dependencies.learningCycleStore.setResurfacingSuppressed(recordId, suppressed, this.now());
  }
}
