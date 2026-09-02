// `Worldfire` — everything to exile, every life total to 1. The set-to-1 is
// the branch worth pinning: a player already at 1 is untouched, and one at 40
// drops 39. That is an absolute `to`, not a loss of N.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WORLDFIRE_SCRIPT } from './worldfire';
import { WORLDFIRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Worldfire';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, BEARS],
      [BEARS],
    ],
    scripts: createRegistry([WORLDFIRE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  // Put something in a graveyard so the graveyard sweep has work to do.
  must(
    g.submit({
      t: 'ManualMoveCard',
      player: 'p2',
      card: theirs,
      to: { kind: 'graveyard', player: 'p2' },
    }),
  );
  const second = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 12 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs: second };
}

describe('Worldfire', () => {
  test('every permanent is EXILED, mine and theirs', () => {
    const { g, mine, theirs } = cast();
    expect(g.state.cards[mine]?.zone.kind).toBe('exile');
    expect(g.state.cards[theirs]?.zone.kind).toBe('exile');
  });

  test('every hand is emptied, and the ONLY card left in any graveyard is Worldfire itself', () => {
    const { g } = cast();
    for (const p of ['p1', 'p2'] as const) expect(idsIn(g, p, 'hand')).toHaveLength(0);
    expect(idsIn(g, 'p2', 'graveyard')).toHaveLength(0);
    // ⚠️ CR 608.2n: a resolving sorcery is still on the STACK while it exiles
    // the graveyards, and only goes to the graveyard AFTERWARDS — so it is the
    // one card that survives its own sweep. The real card is famous for it.
    // The first cut of this test asserted an empty graveyard and was wrong.
    const mine = idsIn(g, 'p1', 'graveyard');
    expect(mine).toHaveLength(1);
    expect(g.deps.oracle.byPrinting(g.state.cards[mine[0]!]!.printingId)?.name).toBe(SPELL);
  });

  test('every life total BECOMES 1', () => {
    const { g } = cast();
    expect(g.state.players['p1']?.life).toBe(1);
    expect(g.state.players['p2']?.life).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WORLDFIRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WORLDFIRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WORLDFIRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
