// `Iridian Maelstrom` — everything that is not ALL five colors dies;
// Atogatog rides it out.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { IRIDIAN_MAELSTROM_SCRIPT } from './iridianMaelstrom';
import { IRIDIAN_MAELSTROM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function swirled(): { g: Game; bears: InstanceId; atog: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Iridian Maelstrom'], ['Grizzly Bears', 'Atogatog']],
    scripts: createRegistry([IRIDIAN_MAELSTROM_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const atog = put(g, 'p2', 'Atogatog');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Iridian Maelstrom', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, atog };
}

describe('Iridian Maelstrom', () => {
  test('the mono-green 2/2 dies; the five-color Atogatog is exempt', () => {
    const { g, bears, atog } = swirled();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[atog]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = IRIDIAN_MAELSTROM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, IRIDIAN_MAELSTROM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(IRIDIAN_MAELSTROM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = swirled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
