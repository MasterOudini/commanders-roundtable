// `Hellfire` — the nonblack sweep pays X+3 back: two die, the black 6/6
// stands, and I take 5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HELLFIRE_SCRIPT } from './hellfire';
import { HELLFIRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function burned(): { g: Game; bears: InstanceId; herder: InstanceId; whisperer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Hellfire', 'Elvish Herder'], ['Grizzly Bears', 'Doom Whisperer']],
    scripts: createRegistry([HELLFIRE_SCRIPT]),
  });
  const herder = put(g, 'p1', 'Elvish Herder');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const whisperer = put(g, 'p2', 'Doom Whisperer');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hellfire', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, herder, whisperer };
}

describe('Hellfire', () => {
  test('the two green creatures die, the black 6/6 stands, and I take 2+3', () => {
    const { g, bears, herder, whisperer } = burned();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[herder]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[whisperer]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p1']?.life).toBe(35);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HELLFIRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HELLFIRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HELLFIRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = burned();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
