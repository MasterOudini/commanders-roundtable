// `Flame Sweep` — 2 to each creature EXCEPT my flyers: my Strix lives,
// THEIR Strix dies, and my grounded Bears die too.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLAME_SWEEP_SCRIPT } from './flameSweep';
import { FLAME_SWEEP } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swept(): { g: Game; myFlyer: InstanceId; myBears: InstanceId; theirFlyer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Flame Sweep', 'Baleful Strix', 'Grizzly Bears'], ['Baleful Strix']],
    scripts: createRegistry([FLAME_SWEEP_SCRIPT]),
  });
  const myFlyer = put(g, 'p1', 'Baleful Strix');
  const myBears = put(g, 'p1', 'Grizzly Bears');
  const theirFlyer = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flame Sweep', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, myFlyer, myBears, theirFlyer };
}

describe('Flame Sweep', () => {
  test('my flyer is exempt; my grounded creature and THEIR flyer both die', () => {
    const { g, myFlyer, myBears, theirFlyer } = swept();
    expect(g.state.cards[myFlyer]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[myBears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[theirFlyer]?.zone.kind).toBe('graveyard');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLAME_SWEEP.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLAME_SWEEP.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLAME_SWEEP.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swept();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
