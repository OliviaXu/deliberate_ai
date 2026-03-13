export class ReflectionEligibilityTracker {
  private readonly trackedSubmitCounts = new Map<string, number>();

  startTrackingThread(threadId: string): void {
    // The second turn starts tracking and counts as the first tracked turn.
    this.trackedSubmitCounts.set(threadId, 1);
  }

  observeFollowUpSubmission(threadId: string): void {
    const trackedSubmitCount = this.trackedSubmitCounts.get(threadId);
    if (trackedSubmitCount === undefined) return;
    this.trackedSubmitCounts.set(threadId, trackedSubmitCount + 1);
  }

  getTrackedSubmitCount(threadId: string): number {
    return this.trackedSubmitCounts.get(threadId) ?? 0;
  }
}
