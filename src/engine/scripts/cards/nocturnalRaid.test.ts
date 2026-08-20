// `Nocturnal Raid` — the black Titan swells to 8/6; the green Bears is
// untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { NOCTURNAL_RAID_SCRIPT } from './nocturnalRaid';
import { NOCTURNAL_RAID } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { derive } from '../../derive';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raided(): { g: Game; titan: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Nocturnal Raid', 'Grave Titan'], ['Grizzly Bears']],
    scripts: createRegistry([NOCTURNAL_RAID_SCRIPT]),
  });
  const titan = put(g, 'p1', 'Grave Titan');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Nocturnal Raid', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, titan, bears };
}

describe('Nocturnal Raid', () => {
  test('the black Titan reads 8/6; the green Bears stays 2/2', () => {
    const { g, titan, bears } = raided();
    const t = derive(g.state, ORACLE, g.deps.scripts, titan);
    expect(t.power).toBe(8);
    expect(t.toughness).toBe(6);
    const b = derive(g.state, ORACLE, g.deps.scripts, bears);
    expect(b.power).toBe(2);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = NOCTURNAL_RAID.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, NOCTURNAL_RAID.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(NOCTURNAL_RAID.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = raided();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
