// `Fallow Earth` — the land sits on TOP of its owner's library.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FALLOW_EARTH_SCRIPT } from './fallowEarth';
import { FALLOW_EARTH } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function fallowed(): { g: Game; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Fallow Earth'], ['Mountain']],
    scripts: createRegistry([FALLOW_EARTH_SCRIPT]),
  });
  const land = put(g, 'p2', 'Mountain');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Fallow Earth', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: land }] }));
  settle(g);
  return { g, land };
}

describe('Fallow Earth', () => {
  test('the land sits on TOP of its owner\'s library', () => {
    const { g, land } = fallowed();
    expect(g.state.cards[land]?.zone.kind).toBe('library');
    const lib = g.state.zones.library['p2'] ?? [];
    expect(lib[lib.length - 1]).toBe(land);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FALLOW_EARTH.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FALLOW_EARTH.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FALLOW_EARTH.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = fallowed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
