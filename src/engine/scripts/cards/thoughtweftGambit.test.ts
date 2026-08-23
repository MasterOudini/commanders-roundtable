// `Thoughtweft Gambit` — theirs go down, mine come up, in one resolve.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { THOUGHTWEFT_GAMBIT_SCRIPT } from './thoughtweftGambit';
import { THOUGHTWEFT_GAMBIT } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const GAMBIT = 'Thoughtweft Gambit';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gambit(): { g: Game; mine: InstanceId; theirs: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[GAMBIT, BEARS, RING], [BEARS]],
    scripts: createRegistry([THOUGHTWEFT_GAMBIT_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const ring = put(g, 'p1', RING);
  settle(g);
  // Mine starts TAPPED and theirs UNTAPPED, so both halves have work to do.
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mine], tapped: true }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', GAMBIT, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, ring };
}

describe('Thoughtweft Gambit', () => {
  test('theirs is tapped and mine is untapped, from one resolve', () => {
    const { g, mine, theirs } = gambit();
    expect(g.state.cards[theirs]?.tapped).toBe(true);
    expect(g.state.cards[mine]?.tapped).toBe(false);
  });

  test('a noncreature of mine is untouched — the sweep is creatures only', () => {
    const { g, ring } = gambit();
    expect(g.state.cards[ring]?.tapped).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = THOUGHTWEFT_GAMBIT.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, THOUGHTWEFT_GAMBIT.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(THOUGHTWEFT_GAMBIT.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gambit();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
