import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetRegistry, setDropOrigin, takeDropOrigin } from './rectRegistry';

// The drop origin — tier 0 of the resolution ladder, written only by an input
// gesture. Both halves of its contract are tested here because both halves are
// what stop it becoming a wrong flight LATER, in a group nobody was looking at.

const RECT = { left: 120, top: 340, width: 101, height: 141 };

afterEach(() => {
  vi.useRealTimers();
  _resetRegistry();
});

describe('drop origins', () => {
  it('hands back the rect the gesture set', () => {
    setDropOrigin('c1', RECT);
    expect(takeDropOrigin('c1')).toEqual(RECT);
  });

  it('is CONSUMED by the first read', () => {
    setDropOrigin('c1', RECT);
    takeDropOrigin('c1');
    // Otherwise the card's next flight — a discard ten turns later — would start
    // from a battlefield slot nobody dropped it on.
    expect(takeDropOrigin('c1')).toBeNull();
  });

  it('is null for a card that was never dropped', () => {
    expect(takeDropOrigin('never-touched')).toBeNull();
  });

  it('expires, so a refused intent leaves nothing behind', () => {
    vi.useFakeTimers({ toFake: ['performance'] });
    setDropOrigin('c1', RECT);
    vi.advanceTimersByTime(1001);
    expect(takeDropOrigin('c1')).toBeNull();
  });

  it('keeps origins apart per card', () => {
    const other = { left: 4, top: 5, width: 6, height: 7 };
    setDropOrigin('c1', RECT);
    setDropOrigin('c2', other);
    expect(takeDropOrigin('c2')).toEqual(other);
    expect(takeDropOrigin('c1')).toEqual(RECT);
  });

  it('is cleared by a registry reset', () => {
    setDropOrigin('c1', RECT);
    _resetRegistry();
    expect(takeDropOrigin('c1')).toBeNull();
  });
});
