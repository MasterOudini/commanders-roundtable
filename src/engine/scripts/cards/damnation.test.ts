// `Damnation` — the first board wipe: both sides die simultaneously,
// indestructible survives, and the regeneration clause is pinned VACUOUS
// (the engine has no regeneration to forbid — the whole-card claim's
// honesty argument, in a test rather than a comment).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DAMNATION_SCRIPT } from './damnation';
import { DAMNATION } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; mine: InstanceId; theirs: InstanceId; myr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Damnation', 'Grizzly Bears'], ['Grizzly Bears', 'Darksteel Myr']],
    scripts: createRegistry([DAMNATION_SCRIPT]),
  });
  const mine = put(g, 'p1', 'Grizzly Bears');
  const theirs = put(g, 'p2', 'Grizzly Bears');
  const myr = put(g, 'p2', 'Darksteel Myr');
  settle(g);
  const wrath = put(g, 'p1', 'Damnation', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath }));
  settle(g);
  return { g, mine, theirs, myr };
}

describe('Damnation', () => {
  test('both sides die; the indestructible Myr survives', () => {
    const { g, mine, theirs, myr } = board();
    expect(g.state.cards[mine]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirs]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[myr]?.zone.kind).toBe('battlefield');
  });

  test('the deaths are ONE event — simultaneous, not sequential', () => {
    const { g } = board();
    const wipes = g.log.filter(
      (e) => e.body.t === 'CardsMoved' && e.body.moves.length >= 2 &&
        e.body.moves.every((m) => m.to.kind === 'graveyard'),
    );
    expect(wipes.length).toBe(1);
  });

  // ⚠️ The "can't be regenerated" clause's honesty argument — the engine has
  // no regeneration for it to forbid — is a SOURCE-SCAN tripwire and lives in
  // damnation.node.test.ts (a scan needs node:fs, which a plain engine test
  // may not import).

  test('the suppression predicate holds (D187)', () => {
    const text = DAMNATION.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DAMNATION.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DAMNATION.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
