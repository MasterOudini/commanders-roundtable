// `Nausea` — the 2/2 dies through the SBA; the 6/6 stands at 5/5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NAUSEA_SCRIPT } from './nausea';
import { NAUSEA } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function sickened(): { g: Game; bears: InstanceId; titan: InstanceId } {
  const g = startedGame({
    players: 2,
    // The victim must be a 1/1 — a 2/2 at -1/-1 is a LIVING 1/1.
    decks: [['Nausea', 'Grave Titan'], ['Aysen Bureaucrats']],
    scripts: createRegistry([NAUSEA_SCRIPT]),
  });
  const titan = put(g, 'p1', 'Grave Titan');
  const bears = put(g, 'p2', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Nausea', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, titan };
}

describe('Nausea', () => {
  test('the 1/1 dies; the 6/6 shaves to 5/5', () => {
    const { g, bears, titan } = sickened();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    const d = derive(g.state, ORACLE, g.deps.scripts, titan);
    expect(d.power).toBe(5);
    expect(d.toughness).toBe(5);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NAUSEA.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NAUSEA.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NAUSEA.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sickened();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
