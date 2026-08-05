import { beforeEach, describe, expect, test } from 'vitest';
import { useTable } from './tableStore';

// The mana batch: shift-click builds it, Escape unwinds it one source at a time.
//
// ⚠️ Store-level, in the node environment, exactly as `dragStore.test.ts` is.
// What the panel DRAWS is the animation battery's job; that the selection
// behaves like a selection is this one's, and it is the part with a rule in it.

function reset(): void {
  useTable.setState({ manaChoice: null, cardMenu: null, attachments: null, mode: { kind: 'idle' } });
}

describe('the mana batch', () => {
  beforeEach(reset);

  test('the first shift-click opens it with one source', () => {
    useTable.getState().toggleManaChoice(['forest'], 10, 20);
    expect(useTable.getState().manaChoice).toMatchObject({ cards: ['forest'], x: 10, y: 20 });
  });

  test('more shift-clicks add, in the order they were picked up', () => {
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(['forest'], 0, 0);
    toggleManaChoice(['island'], 0, 0);
    toggleManaChoice(['tundra'], 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['forest', 'island', 'tundra']);
  });

  /** ⚠️ The panel stays where it opened: a batch has no one pixel. */
  test('adding a source does not move the panel', () => {
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(['forest'], 10, 20);
    toggleManaChoice(['island'], 900, 700);
    expect(useTable.getState().manaChoice).toMatchObject({ x: 10, y: 20 });
  });

  test('shift-clicking a source again takes it back out', () => {
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(['forest'], 0, 0);
    toggleManaChoice(['island'], 0, 0);
    toggleManaChoice(['forest'], 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['island']);
  });

  /** A panel listing nothing, still anchored to a card, is a dialog about no question. */
  test('taking the last one back out closes it', () => {
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(['forest'], 0, 0);
    toggleManaChoice(['forest'], 0, 0);
    expect(useTable.getState().manaChoice).toBeNull();
  });

  /**
   * ⚠️ ONE STEP AT A TIME, for the reason the attacker list backs out one at a
   * time: a player who shift-clicked five lands and taps Escape to shed the last
   * one must not lose the other four.
   */
  test('Escape drops the last source, not the batch', () => {
    const { toggleManaChoice, escape } = useTable.getState();
    toggleManaChoice(['a'], 0, 0);
    toggleManaChoice(['b'], 0, 0);
    toggleManaChoice(['c'], 0, 0);
    escape();
    expect(useTable.getState().manaChoice?.cards).toEqual(['a', 'b']);
    escape();
    expect(useTable.getState().manaChoice?.cards).toEqual(['a']);
    escape();
    expect(useTable.getState().manaChoice).toBeNull();
  });

  /**
   * ⚠️ A PILE IS ONE SLOT AND MANY CARDS. Twelve identical Forests render as a
   * single thing to point at (D19), so every shift-click named the same
   * representative and the second one took it straight back out — five clicks
   * could never mean five Forests.
   */
  test('shift-clicking a pile takes one more of it each time', () => {
    const pile = ['f1', 'f2', 'f3'];
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(pile, 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['f1']);
    toggleManaChoice(pile, 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['f1', 'f2']);
    toggleManaChoice(pile, 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['f1', 'f2', 'f3']);
  });

  /** Clicking past the end of a pile clears that pile — the one-card toggle, generalised. */
  test('once the whole pile is in, the next click clears it', () => {
    const pile = ['f1', 'f2'];
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(['island'], 0, 0);
    toggleManaChoice(pile, 0, 0);
    toggleManaChoice(pile, 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['island', 'f1', 'f2']);
    toggleManaChoice(pile, 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['island']);
  });

  test('a pile takes only what it is offered — a tapped member is never named', () => {
    // The caller filters to what `legal` allows; the store adds in that order.
    const { toggleManaChoice } = useTable.getState();
    toggleManaChoice(['f2', 'f3'], 0, 0);
    toggleManaChoice(['f2', 'f3'], 0, 0);
    expect(useTable.getState().manaChoice?.cards).toEqual(['f2', 'f3']);
  });

  test('an empty slot does nothing at all', () => {
    useTable.getState().toggleManaChoice([], 0, 0);
    expect(useTable.getState().manaChoice).toBeNull();
  });

  test('the three anchored panels are mutually exclusive', () => {
    const s = useTable.getState();
    s.openManaChoice(['forest'], 0, 0);
    s.openCardMenu('forest', 0, 0);
    expect(useTable.getState().manaChoice).toBeNull();
    s.openManaChoice(['forest'], 0, 0);
    expect(useTable.getState().cardMenu).toBeNull();
    s.openAttachments('bear', 0, 0);
    expect(useTable.getState().manaChoice).toBeNull();
  });

  /** A dialog is in front of everything; Escape must answer it first. */
  test('an open dialog wins the Escape', () => {
    const s = useTable.getState();
    s.openManaChoice(['a', 'b'], 0, 0);
    s.askNumber({ title: 't', label: 'l', initial: 1, min: 0, max: 9, onSubmit: () => {} });
    useTable.getState().escape();
    expect(useTable.getState().numberRequest).toBeNull();
    expect(useTable.getState().manaChoice?.cards).toEqual(['a', 'b']);
  });
});
