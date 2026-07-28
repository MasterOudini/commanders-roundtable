import { beforeEach, describe, expect, it } from 'vitest';
import { heldInstanceId, useDrag } from './dragStore';

// The drag phase machine. Small, but every guard here is what stops a ghost from
// being stranded on the table — the one failure this store is able to cause.

const CARD = {
  instanceId: 'i1',
  card: null,
  faceIndex: 0,
  w: 101,
  h: 141,
  x: 10,
  y: 20,
  ok: true,
  hint: 'Play Forest',
};

beforeEach(() => useDrag.getState().reset());

describe('dragStore', () => {
  it('starts idle and holds nothing', () => {
    expect(useDrag.getState().phase).toBe('idle');
    expect(heldInstanceId()).toBeNull();
  });

  it('holds the card from the moment the drag begins', () => {
    useDrag.getState().begin(CARD);
    expect(useDrag.getState().phase).toBe('dragging');
    expect(heldInstanceId()).toBe('i1');
  });

  it('tracks the pointer and the zone while dragging', () => {
    useDrag.getState().begin(CARD);
    useDrag.getState().move(300, 400, true);
    const s = useDrag.getState();
    expect([s.x, s.y, s.over]).toEqual([300, 400, true]);
  });

  it('ignores a move once the card has been let go', () => {
    useDrag.getState().begin(CARD);
    useDrag.getState().move(300, 400, true);
    useDrag.getState().release();
    // A parked card marks where the player dropped it, and the flight layer uses
    // that rect as its source. A late pointermove must not slide it.
    useDrag.getState().move(999, 999, false);
    const s = useDrag.getState();
    expect([s.x, s.y, s.phase]).toEqual([300, 400, 'released']);
  });

  it('only releases from a live drag', () => {
    useDrag.getState().release();
    expect(useDrag.getState().phase).toBe('idle');
  });

  it('returns home from either dragging or released, and only once', () => {
    useDrag.getState().begin(CARD);
    useDrag.getState().returnHome();
    expect(useDrag.getState().phase).toBe('returning');
    useDrag.getState().returnHome();
    expect(useDrag.getState().phase).toBe('returning');
  });

  it('keeps holding the card while it flies home, so the fan slot stays empty', () => {
    useDrag.getState().begin(CARD);
    useDrag.getState().returnHome();
    expect(heldInstanceId()).toBe('i1');
    useDrag.getState().reset();
    expect(heldInstanceId()).toBeNull();
  });

  it('never leaves a card held after a reset', () => {
    useDrag.getState().begin(CARD);
    useDrag.getState().release();
    useDrag.getState().reset();
    const s = useDrag.getState();
    expect([s.phase, s.instanceId, s.over, s.hint]).toEqual(['idle', null, false, null]);
  });
});
