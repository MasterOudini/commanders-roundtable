// `Temporal Eddy` — the creature-or-land compound (D213) put on TOP of its
// owner's library. The land arm is the one that matters: it is the exact
// shape Fissure's own test forced out of the parser.
//
// ⚠️ "On top" is asserted by DRAWING it back: the library appends and
// drawFromTop takes from the END, so a placement bug is invisible to a
// zone-membership check alone (D253).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { TEMPORAL_EDDY_SCRIPT } from './temporalEddy';
import { TEMPORAL_EDDY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const EDDY = 'Temporal Eddy';
const BEARS = 'Grizzly Bears';
const MOUNTAIN = 'Mountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function eddied(which: 'creature' | 'land'): { g: Game; victim: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[EDDY], [BEARS, MOUNTAIN]],
    scripts: createRegistry([TEMPORAL_EDDY_SCRIPT]),
  });
  const victim = put(g, 'p2', which === 'creature' ? BEARS : MOUNTAIN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', EDDY, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim };
}

describe('Temporal Eddy', () => {
  test('a creature goes on TOP of its owner\'s library', () => {
    const { g, victim } = eddied('creature');
    expect(g.state.cards[victim]?.zone.kind).toBe('library');
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(victim);
  });

  test('a LAND is the other arm of the compound — the halving D213 fixed', () => {
    const { g, victim } = eddied('land');
    expect(g.state.cards[victim]?.zone.kind).toBe('library');
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(victim);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = TEMPORAL_EDDY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, TEMPORAL_EDDY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(TEMPORAL_EDDY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = eddied('land');
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
