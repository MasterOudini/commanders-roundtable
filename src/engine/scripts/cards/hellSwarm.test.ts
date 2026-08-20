// `Hell Swarm` — -1/-0 across the board: powers drop, toughness holds,
// nothing dies.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HELL_SWARM_SCRIPT } from './hellSwarm';
import { HELL_SWARM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swarmed(): { g: Game; bears: InstanceId; herder: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hell Swarm', 'Elvish Herder'], ['Grizzly Bears']],
    scripts: createRegistry([HELL_SWARM_SCRIPT]),
  });
  const herder = put(g, 'p1', 'Elvish Herder');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hell Swarm', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, herder };
}

describe('Hell Swarm', () => {
  test('the 2/2 reads 1/2, the 1/1 reads 0/1, both alive', () => {
    const { g, bears, herder } = swarmed();
    expect(derive(g.state, ORACLE, g.deps.scripts, bears).power).toBe(1);
    expect(derive(g.state, ORACLE, g.deps.scripts, herder).power).toBe(0);
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[herder]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HELL_SWARM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HELL_SWARM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HELL_SWARM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swarmed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
