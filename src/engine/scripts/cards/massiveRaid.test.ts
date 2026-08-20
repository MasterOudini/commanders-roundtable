// `Massive Raid` — two creatures, two damage at a player.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { MASSIVE_RAID_SCRIPT } from './massiveRaid';
import { MASSIVE_RAID } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function raided(): Game {
  const g = startedGame({
    players: 2,
    decks: [['Massive Raid', 'Grizzly Bears', 'Aysen Bureaucrats'], []],
    scripts: createRegistry([MASSIVE_RAID_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears');
  put(g, 'p1', 'Aysen Bureaucrats');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Massive Raid', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(
    g.submit({
      t: 'CastSpell',
      player: 'p1',
      card: spell,
      targets: [{ kind: 'player', id: 'p2' }],
    }),
  );
  settle(g);
  return g;
}

describe('Massive Raid', () => {
  test('two creatures deal two at the targeted player', () => {
    const g = raided();
    expect(g.state.players['p2']?.life).toBe(38);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = MASSIVE_RAID.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, MASSIVE_RAID.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(MASSIVE_RAID.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const g = raided();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
