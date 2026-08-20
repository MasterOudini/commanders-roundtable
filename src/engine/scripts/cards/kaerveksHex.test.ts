// `Kaervek's Hex` — the arms sum per creature: green takes 2, white 1,
// black nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { KAERVEKS_HEX_SCRIPT } from './kaerveksHex';
import { KAERVEK_S_HEX } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hexed(): { g: Game; bears: InstanceId; clerk: InstanceId; whisperer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Kaervek's Hex"], ['Grizzly Bears', 'Aysen Bureaucrats', 'Doom Whisperer']],
    scripts: createRegistry([KAERVEKS_HEX_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const clerk = put(g, 'p2', 'Aysen Bureaucrats');
  const whisperer = put(g, 'p2', 'Doom Whisperer');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Kaervek's Hex", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, clerk, whisperer };
}

describe("Kaervek's Hex", () => {
  test('green 2/2 takes 2 and dies; white 1/1 takes 1 and dies; black 6/6 takes nothing', () => {
    const { g, bears, clerk, whisperer } = hexed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[clerk]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[whisperer]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[whisperer]?.damage).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = KAERVEK_S_HEX.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, KAERVEK_S_HEX.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(KAERVEK_S_HEX.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hexed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
