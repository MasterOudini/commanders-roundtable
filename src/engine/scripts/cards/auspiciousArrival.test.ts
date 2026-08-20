// `Auspicious Arrival` — the pump plus Investigate: the target gets +2/+2
// and a Clue the oracle can NAME arrives either way.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { AUSPICIOUS_ARRIVAL_SCRIPT } from './auspiciousArrival';
import { AUSPICIOUS_ARRIVAL } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cast(): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Auspicious Arrival', 'Grizzly Bears'], ['Grizzly Bears']],
    scripts: createRegistry([AUSPICIOUS_ARRIVAL_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Auspicious Arrival', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

function clues(g: Game): InstanceId[] {
  return (g.state.zones.battlefield as InstanceId[]).filter((id) => {
    const c = g.state.cards[id];
    if (!c?.isToken || c.controller !== 'p1') return false;
    return g.deps.oracle.byPrinting(c.printingId)?.name === 'Clue';
  });
}

describe('Auspicious Arrival', () => {
  test('the target is a 4/4 and a NAMEABLE Clue arrived', () => {
    const { g, bears } = cast();
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, bears).power).toBe(4);
    expect(derive(g.state, g.deps.oracle, g.deps.scripts, bears).toughness).toBe(4);
    expect(clues(g)).toHaveLength(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = AUSPICIOUS_ARRIVAL.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, AUSPICIOUS_ARRIVAL.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(AUSPICIOUS_ARRIVAL.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
