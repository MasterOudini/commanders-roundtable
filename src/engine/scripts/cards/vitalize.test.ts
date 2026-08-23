// `Vitalize` — untap all MY creatures. Theirs stay down, and so does my
// non-creature.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { VITALIZE_SCRIPT } from './vitalize';
import { VITALIZE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Vitalize';
const BEARS = 'Grizzly Bears';
const RING = 'Sol Ring';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; mine: InstanceId; ring: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS, RING], [BEARS]],
    scripts: createRegistry([VITALIZE_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const ring = put(g, 'p1', RING);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  must(g.submit({ t: 'ManualSetTapped', player: 'p1', cards: [mine, ring, theirs], tapped: true }));
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, ring, theirs };
}

describe('Vitalize', () => {
  test('my creature comes up', () => {
    const { g, mine } = cast();
    expect(g.state.cards[mine]?.tapped).toBe(false);
  });

  test('my non-creature stays down', () => {
    const { g, ring } = cast();
    expect(g.state.cards[ring]?.tapped).toBe(true);
  });

  test("an OPPONENT's creature stays down", () => {
    const { g, theirs } = cast();
    expect(g.state.cards[theirs]?.tapped).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = VITALIZE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, VITALIZE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(VITALIZE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
