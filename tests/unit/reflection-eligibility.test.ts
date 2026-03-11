import { describe, expect, it } from 'vitest';
import { ReflectionEligibilityTracker } from '../../src/content/reflection-eligibility';

describe('ReflectionEligibilityTracker', () => {
  it('starts tracked submit counting at one for the thread that begins active tracking', () => {
    const tracker = new ReflectionEligibilityTracker();

    tracker.startTrackingThread('/app/threads/thread-a');

    expect(tracker.getTrackedSubmitCount('/app/threads/thread-a')).toBe(1);
  });

  it('increments tracked submit counts only for threads already under active tracking', () => {
    const tracker = new ReflectionEligibilityTracker();

    tracker.startTrackingThread('/app/threads/thread-a');
    tracker.observeFollowUpSubmission('/app/threads/thread-a');
    tracker.observeFollowUpSubmission('/app/threads/thread-a');
    tracker.observeFollowUpSubmission('/app/threads/thread-missing');

    expect(tracker.getTrackedSubmitCount('/app/threads/thread-a')).toBe(3);
    expect(tracker.getTrackedSubmitCount('/app/threads/thread-missing')).toBe(0);
  });

  it('returns zero when a thread has no active tracked submit count', () => {
    const tracker = new ReflectionEligibilityTracker();

    expect(tracker.getTrackedSubmitCount('/app/threads/thread-a')).toBe(0);
  });
});
