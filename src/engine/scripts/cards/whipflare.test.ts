// `Whipflare` — 2 to every creature EXCEPT the artifact ones. The artifact
// creature is the whole card.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { WHIPFLARE_SCRIPT } from './whipflare';
import { WHIPFLARE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Whipflare';
const TITAN = 'Grave Titan'; // 6/6 plain creature — survives, damage readable
const ROBOT = 'Voltaic Servant'; // ARTIFACT creature — spared
const RING = 'Sol Ring'; // artifact, not a creature — spared

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; titan: InstanceId; robot: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      [SPELL, ROBOT, RING],
      [TITAN],
    ],
    scripts: createRegistry([WHIPFLARE_SCRIPT]),
  });
  const titan = put(g, 'p2', TITAN);
  const robot = put(g, 'p1', ROBOT);
  const ring = put(g, 'p1', RING);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, titan, robot, ring };
}

describe('Whipflare', () => {
  test('a plain creature takes 2', () => {
    const { g, titan } = cast();
    expect(g.state.cards[titan]?.damage).toBe(2);
  });

  test('an ARTIFACT creature takes nothing', () => {
    const { g, robot } = cast();
    expect(g.state.cards[robot]?.damage ?? 0).toBe(0);
  });

  test('a non-creature artifact is untouched', () => {
    const { g, ring } = cast();
    expect(g.state.cards[ring]?.damage ?? 0).toBe(0);
    expect(g.state.cards[ring]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = WHIPFLARE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, WHIPFLARE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(WHIPFLARE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
