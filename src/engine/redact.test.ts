import { describe, expect, test } from 'vitest';
import { redactBatch, redactEvent } from './redact';
import { toViewEvents } from './viewEvents';
import { advanceUntil, must, newTestGame, startedGame } from './testing/harness';
import type { EventBody } from './types/events';

// The three rules the M4 brief names, plus the one this file found on the way.
//
// ⚠️ Asserted against events the ENGINE actually produced, not against
// hand-written literals. A hand-written `LibraryShuffled` proves the switch
// statement works; a real one proves the event the game emits at setup is the
// shape the switch expects.

function bodiesOf(game: ReturnType<typeof newTestGame>, kind: EventBody['t']): EventBody[] {
  return game.log.filter((e) => e.body.t === kind).map((e) => e.body);
}

describe('redactEvent', () => {
  test('LibraryShuffled.order is stripped for EVERYONE, including the owner', () => {
    const game = newTestGame({ players: 4 });
    const shuffles = bodiesOf(game, 'LibraryShuffled');
    expect(shuffles.length).toBeGreaterThan(0);

    for (const body of shuffles) {
      if (body.t !== 'LibraryShuffled') throw new Error('narrowing');
      expect(body.order.length).toBeGreaterThan(0);
      // The owner is redacted exactly as hard as everyone else. That is the
      // whole invariant: the host holds the order and shows it to nobody.
      for (const viewer of ['p1', 'p2', 'p3', 'p4']) {
        const out = redactEvent(body, viewer);
        expect(out?.t).toBe('LibraryShuffled');
        if (out?.t !== 'LibraryShuffled') throw new Error('narrowing');
        expect(out.order).toEqual([]);
        expect(out.player).toBe(body.player);
      }
    }
  });

  test('DeckLoaded.cards is stripped, and the commanders survive', () => {
    const game = newTestGame({ players: 2 });
    const decks = bodiesOf(game, 'DeckLoaded');
    expect(decks.length).toBe(2);

    for (const body of decks) {
      if (body.t !== 'DeckLoaded') throw new Error('narrowing');
      expect(body.cards.length).toBeGreaterThan(20);
      const out = redactEvent(body, body.player);
      if (out?.t !== 'DeckLoaded') throw new Error('narrowing');
      expect(out.cards).toEqual([]);
      // A commander starts face up in the command zone — public by definition.
      expect(out.commanders).toEqual(body.commanders);
      expect(out.identity).toEqual(body.identity);
    }
  });

  test('the game seed never leaves the host', () => {
    const game = newTestGame({ players: 2, seed: 'secret-seed' });
    const created = bodiesOf(game, 'GameCreated')[0];
    if (created?.t !== 'GameCreated') throw new Error('no GameCreated');
    expect(created.seed).toBe('secret-seed');
    const out = redactEvent(created, 'p1');
    if (out?.t !== 'GameCreated') throw new Error('narrowing');
    expect(out.seed).toBe('');
    // Everything else about the game's creation is public.
    expect(out.seating).toEqual(created.seating);
    expect(out.options).toEqual(created.options);
  });

  test('ManualPeekLibrary results are visible only to the peeker', () => {
    const game = startedGame({ players: 2 });
    const before = game.log.length;
    must(game.submit({ t: 'ManualPeekLibrary', player: 'p1', count: 3 }));
    const revealed = game.log
      .slice(before)
      .map((e) => e.body)
      .find((b) => b.t === 'CardsRevealed');
    if (revealed?.t !== 'CardsRevealed') throw new Error('no CardsRevealed');
    expect(revealed.cards).toHaveLength(3);
    expect(revealed.to).toEqual(['p1']);

    const forPeeker = redactEvent(revealed, 'p1');
    if (forPeeker?.t !== 'CardsRevealed') throw new Error('narrowing');
    expect(forPeeker.cards).toHaveLength(3);

    const forOther = redactEvent(revealed, 'p2');
    if (forOther?.t !== 'CardsRevealed') throw new Error('narrowing');
    expect(forOther.cards).toEqual([]);
    // p2 still learns that p1 looked at their library — the narration says so.
    expect(forOther.to).toEqual(['p1']);
  });

  test('a library→library move is dropped; a library→hand move is kept', () => {
    const hidden: EventBody = {
      t: 'CardsMoved',
      moves: [
        { card: 'c1', from: { kind: 'library', player: 'p1' }, to: { kind: 'library', player: 'p1' } },
        { card: 'c2', from: { kind: 'library', player: 'p1' }, to: { kind: 'hand', player: 'p1' } },
      ],
    };
    const out = redactEvent(hidden, 'p2');
    if (out?.t !== 'CardsMoved') throw new Error('narrowing');
    expect(out.moves).toHaveLength(1);
    expect(out.moves[0]?.card).toBe('c2');
  });

  test('a real mulligan bottoms cards without leaking where they went', () => {
    // ⚠️ `freeFirstMulligan` is ON by default (D44/Q2), so one mulligan bottoms
    // ZERO cards and no `mulliganBottom` prompt ever appears. A test that
    // expected one here failed with "awaiting is undefined", which reads as a
    // broken prompt rather than as a house rule doing its job.
    const game = newTestGame({ players: 2, options: { freeFirstMulligan: false } });
    must(game.submit({ t: 'MulliganDecision', player: 'p1', keep: false }));
    for (let i = 0; i < 20; i++) {
      const awaiting = game.state.priority.awaiting;
      if (awaiting?.kind !== 'mulligan') break;
      const next = awaiting.players[0];
      if (!next) break;
      must(game.submit({ t: 'MulliganDecision', player: next, keep: true }));
    }
    expect(game.state.priority.awaiting?.kind).toBe('mulliganBottom');
    const hand = [...(game.state.zones.hand['p1'] ?? [])];
    const before = game.log.length;
    must(game.submit({ t: 'MulliganBottom', player: 'p1', cards: [hand[0] as string] }));

    // hand → library is kept (the id was public in the hand); the shuffle that
    // follows it is stripped.
    const produced = game.log.slice(before);
    for (const event of produced) {
      const out = redactEvent(event.body, 'p2');
      if (out?.t === 'LibraryShuffled') expect(out.order).toEqual([]);
    }
  });

  test('an unaffected event is returned by reference — the common path allocates nothing', () => {
    const body: EventBody = { t: 'PermanentsTapped', cards: ['c1'] };
    expect(redactEvent(body, 'p1')).toBe(body);
  });
});

describe('redactBatch', () => {
  test('never drops a Narrated — toViewEvents indexes the log by counting them', () => {
    // ⚠️ This is the trap the redaction funnel could most easily set: dropping
    // one `Narrated` shifts every rendered log line in that group onto the wrong
    // text, and nothing throws.
    const game = startedGame({ players: 2 });
    const before = game.log.length;
    must(game.submit({ t: 'ManualPeekLibrary', player: 'p1', count: 2 }));
    const produced = game.log.slice(before);
    const narratedBefore = produced.filter((e) => e.body.t === 'Narrated').length;
    expect(narratedBefore).toBeGreaterThan(0);
    for (const viewer of ['p1', 'p2']) {
      const after = redactBatch(produced, viewer);
      expect(after.filter((e) => e.body.t === 'Narrated').length).toBe(narratedBefore);
    }
  });

  test('the redacted stream still produces the same animation cues for the actor', () => {
    // A redaction that changed what the acting player sees animate would be a
    // regression dressed as a security fix.
    const game = startedGame({ players: 2 });
    const before = game.log.length;
    must(game.submit({ t: 'PassPriority', player: game.state.priority.player ?? 'p1' }));
    const produced = game.log.slice(before);
    const direct = toViewEvents(produced, game.state, 'p1');
    const viaRedaction = toViewEvents(redactBatch(produced, 'p1'), game.state, 'p1');
    expect(viaRedaction).toEqual(direct);
  });

  test('a whole real game redacts for every seat without throwing', () => {
    const game = startedGame({ players: 4 });
    advanceUntil(game, (s) => s.turn.turnNumber >= 3);
    for (const viewer of ['p1', 'p2', 'p3', 'p4']) {
      const out = redactBatch(game.log, viewer);
      expect(out.length).toBe(game.log.length);
      for (const event of out) {
        if (event.body.t === 'LibraryShuffled') expect(event.body.order).toEqual([]);
        if (event.body.t === 'DeckLoaded') expect(event.body.cards).toEqual([]);
        if (event.body.t === 'GameCreated') expect(event.body.seed).toBe('');
      }
    }
  });
});
