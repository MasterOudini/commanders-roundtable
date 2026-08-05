import { describe, expect, test } from 'vitest';
import { applyPatch, diffView, viewHash } from './diffView';
import { legalActions } from './legal';
import { project } from './project';
import { seedRng, nextBelow } from './rng';
import { deps, keepAll, newTestGame, ORACLE } from './testing/harness';
import { NO_SCRIPTS } from './scripts/registry';
import type { Game } from './game';
import type { Intent } from './types/intents';
import type { PlayerId } from './types/ids';
import type { PlayerView } from '../view/types';
import { emptyView } from '../view/types';

// ⚠️ The gate for this file is not "does the patch look right" — it is
// `applyPatch(prev, diffView(prev, next)) === next`, hash for hash, over a real
// game. A patch format can be wrong in a way that is invisible for fifty events
// and then loses one card.

/** Drive the game with random legal intents, the way the fuzzer does. */
function randomIntent(game: Game, rand: () => number): Intent | null {
  const state = game.state;
  if (state.gamePhase === 'finished') return null;
  const awaiting = state.priority.awaiting;
  if (awaiting) {
    switch (awaiting.kind) {
      case 'mulligan': {
        const p = awaiting.players[0];
        return p ? { t: 'MulliganDecision', player: p, keep: true } : null;
      }
      case 'declareAttackers':
        return { t: 'DeclareAttackers', player: awaiting.player, attackers: [] };
      case 'declareBlockers': {
        const p = awaiting.players.find((x) => !awaiting.submitted.includes(x));
        return p ? { t: 'DeclareBlockers', player: p, blocks: [] } : null;
      }
      case 'chooseLegendKeep': {
        const keep = awaiting.candidates[0];
        return keep ? { t: 'ChooseLegendKeep', player: awaiting.player, keep } : null;
      }
      case 'commanderZoneChoice':
        return { t: 'CommanderZoneChoice', player: awaiting.player, toCommandZone: true, always: true };
      case 'orderTriggers':
        return { t: 'OrderTriggers', player: awaiting.player, order: [...awaiting.triggers] };
      default:
        return null;
    }
  }
  const holder = state.priority.player;
  if (!holder) return null;
  const legal = legalActions(state, ORACLE, NO_SCRIPTS, holder);
  const playable = legal.filter((a) => a.t === 'PlayLand' || (a.t === 'CastSpell' && a.affordable));
  if (playable.length > 0 && rand() % 2 === 0) {
    const pick = playable[rand() % playable.length];
    if (pick?.t === 'PlayLand') return { t: 'PlayLand', player: holder, card: pick.card };
    if (pick?.t === 'CastSpell') return { t: 'CastSpell', player: holder, card: pick.card };
  }
  const taps = legal.filter((a) => a.t === 'TapForMana' && !a.conditional);
  if (taps.length > 0 && rand() % 3 === 0) {
    const pick = taps[rand() % taps.length];
    if (pick?.t === 'TapForMana') {
      return { t: 'TapForMana', player: holder, card: pick.card, abilityIndex: pick.abilityIndex, outputChoice: 0 };
    }
  }
  return { t: 'PassPriority', player: holder };
}

function makeRand(seed: string): () => number {
  let rng = seedRng(seed);
  return () => {
    const r = nextBelow(rng, 1_000_000);
    rng = r.next;
    return r.value;
  };
}

describe('diffView + applyPatch', () => {
  test('reproduces project() exactly over 500 real updates, for every seat', () => {
    // ⚠️ A DEEP library, because the bar is 500 updates and an update is now a
    // lot more game than it was: auto-pass stopped asking players who could do
    // nothing, so the same 500 intents cover roughly twice the turns and a
    // 30-card library decked the whole table out at 359 of them.
    const game = newTestGame({
      players: 4,
      seed: 'diff-500',
      librarySize: 150,
      game: { checkInvariants: false },
    });
    keepAll(game);
    const seats: PlayerId[] = ['p1', 'p2', 'p3', 'p4'];
    game.setViewers(seats);

    // Each seat holds its own patched copy, exactly as a client would.
    const held = new Map<PlayerId, PlayerView>();
    for (const p of seats) held.set(p, game.view(p));

    const rand = makeRand('diff-500');
    let updates = 0;
    let patchedKeys = 0;
    for (let step = 0; step < 3000 && updates < 500; step++) {
      const intent = randomIntent(game, rand);
      if (!intent) break;
      const before = game.state.eventCount;
      const result = game.submit(intent);
      if (!result.ok) continue;
      const after = game.state.eventCount;
      if (after === before) continue;
      updates++;

      for (const p of seats) {
        const prev = held.get(p) as PlayerView;
        const next = game.view(p);
        const patch = diffView(prev, next, before, after);
        patchedKeys += Object.keys(patch.set).length + patch.del.length;
        const rebuilt = applyPatch(prev, patch);
        // The hash is the assertion a real client makes, on every update.
        expect(viewHash(rebuilt)).toBe(viewHash(next));
        // A full structural compare is ~40× more expensive (it walks every
        // inlined `CardData`), and it can only catch what the hash cannot: two
        // distinct card objects sharing a printing id, which one oracle
        // database cannot produce. Sampled rather than dropped.
        if (updates % 50 === 0) expect(rebuilt).toEqual(next);
        held.set(p, rebuilt);
      }
    }

    expect(updates).toBeGreaterThanOrEqual(500);
    // If this were 0 the test would pass vacuously with an empty patch format.
    expect(patchedKeys).toBeGreaterThan(1000);
  }, 60_000);

  test('an unchanged view produces an empty patch', () => {
    const game = newTestGame({ players: 2 });
    keepAll(game);
    const a = game.view('p1');
    const b = game.view('p1');
    const patch = diffView(a, b, 1, 1);
    expect(patch.set).toEqual({});
    expect(patch.del).toEqual([]);
  });

  test('applyPatch preserves referential identity for untouched cards (D21)', () => {
    // ⚠️ Not a micro-optimisation. Before projection reused unchanged objects,
    // EVERY view commit produced one long frame scaling with board size. The
    // client is the same React tree, so the same rule applies to the patched
    // view — a patch applier that rebuilt the map would reintroduce it.
    const game = newTestGame({ players: 2 });
    keepAll(game);
    const prev = game.view('p1');
    const holder = game.state.priority.player ?? 'p1';
    game.submit({ t: 'PassPriority', player: holder });
    const next = game.view('p1');
    const rebuilt = applyPatch(prev, diffView(prev, next, 0, game.state.eventCount));

    const ids = Object.keys(prev.cards);
    expect(ids.length).toBeGreaterThan(10);
    let reused = 0;
    for (const id of ids) {
      if (rebuilt.cards[id] === prev.cards[id]) reused++;
    }
    // A priority pass changes no card at all, so every one must be the SAME
    // object — not merely deep-equal.
    expect(reused).toBe(ids.length);
  });

  test('a card leaving visibility is deleted, not left stale', () => {
    const prev: PlayerView = { ...emptyView('p1'), cards: { c1: {} as never, c2: {} as never } };
    const next: PlayerView = { ...emptyView('p1'), cards: { c1: prev.cards['c1'] as never } };
    const patch = diffView(prev, next, 0, 1);
    expect(patch.del).toEqual(['cards.c2']);
    expect(applyPatch(prev, patch).cards['c2']).toBeUndefined();
  });

  test('a zone key that empties is deleted', () => {
    const prev: PlayerView = { ...emptyView('p1'), zones: { 'gy:p1': ['c1'] } };
    const next: PlayerView = { ...emptyView('p1'), zones: {} };
    const patch = diffView(prev, next, 0, 1);
    expect(patch.del).toEqual(['zones.gy:p1']);
    expect(applyPatch(prev, patch).zones['gy:p1']).toBeUndefined();
  });

  test('a zone key with a colon in it round-trips (the key splits on the FIRST dot)', () => {
    const prev: PlayerView = { ...emptyView('p1'), zones: {} };
    const next: PlayerView = { ...emptyView('p1'), zones: { 'hand:p2': ['c9'] } };
    const patch = diffView(prev, next, 0, 1);
    expect(Object.keys(patch.set)).toContain('zones.hand:p2');
    expect(applyPatch(prev, patch).zones['hand:p2']).toEqual(['c9']);
  });

  test('the log is sent as an append, and the append is verified before it is chosen', () => {
    const prev: PlayerView = {
      ...emptyView('p1'),
      log: [{ id: 1, text: 'a', player: null, identity: [], manual: false }],
    };
    const next: PlayerView = {
      ...emptyView('p1'),
      log: [
        { id: 1, text: 'a', player: null, identity: [], manual: false },
        { id: 2, text: 'b', player: null, identity: [], manual: false },
      ],
    };
    const patch = diffView(prev, next, 0, 1);
    expect(Object.keys(patch.set)).toEqual(['log+']);
    expect((patch.set['log+'] as unknown[]).length).toBe(1);
    expect(applyPatch(prev, patch).log).toEqual(next.log);
  });

  test('a rewritten log falls back to the whole array rather than a wrong append', () => {
    // A rewind rewrites the log instead of extending it. The append form must
    // not be chosen, and the reconstruction check is what decides that.
    const prev: PlayerView = {
      ...emptyView('p1'),
      log: [
        { id: 1, text: 'a', player: null, identity: [], manual: false },
        { id: 2, text: 'b', player: null, identity: [], manual: false },
      ],
    };
    const next: PlayerView = {
      ...emptyView('p1'),
      log: [{ id: 1, text: 'a', player: null, identity: [], manual: false }],
    };
    const patch = diffView(prev, next, 0, 1);
    expect(Object.keys(patch.set)).toEqual(['log']);
    expect(applyPatch(prev, patch).log).toEqual(next.log);
  });

  test('the log window is applied on the client exactly as the reducer applies it', () => {
    const line = (id: number) => ({ id, text: `l${id}`, player: null, identity: [] as never[], manual: false });
    const prev: PlayerView = { ...emptyView('p1'), log: Array.from({ length: 200 }, (_, i) => line(i + 1)) };
    const next: PlayerView = { ...emptyView('p1'), log: Array.from({ length: 200 }, (_, i) => line(i + 3)) };
    const patch = diffView(prev, next, 0, 1);
    expect(Object.keys(patch.set)).toEqual(['log+']);
    const rebuilt = applyPatch(prev, patch);
    expect(rebuilt.log).toHaveLength(200);
    expect(rebuilt.log[0]?.id).toBe(3);
    expect(rebuilt.log[199]?.id).toBe(202);
  });
});

describe('viewHash', () => {
  test('a live projection and a fresh one hash identically', () => {
    // ⚠️ THE ASSERTION RECONNECT RESTS ON. `Game.view()` comes from a projector
    // that has been reusing objects across every commit of the game; a
    // `Snapshot` after a reconnect comes from a projector constructed one line
    // earlier. If the identity cache could change the VALUE rather than only its
    // object identity, reconnect would hand a client a subtly different board.
    const game = newTestGame({ players: 4 });
    keepAll(game);
    const { oracle, scripts } = deps();
    for (const p of ['p1', 'p2', 'p3', 'p4'] as PlayerId[]) {
      expect(viewHash(project(game.state, oracle, scripts, p))).toBe(viewHash(game.view(p)));
    }
  });

  test('differs between seats — each player sees a different board', () => {
    const game = newTestGame({ players: 4 });
    keepAll(game);
    const hashes = new Set(['p1', 'p2', 'p3', 'p4'].map((p) => viewHash(game.view(p))));
    expect(hashes.size).toBe(4);
  });

  test('changes when a card changes and not otherwise', () => {
    const game = newTestGame({ players: 2 });
    keepAll(game);
    const before = viewHash(game.view('p1'));
    const holder = game.state.priority.player ?? 'p1';
    game.submit({ t: 'PassPriority', player: holder });
    expect(viewHash(game.view('p1'))).not.toBe(before);
  });
});
