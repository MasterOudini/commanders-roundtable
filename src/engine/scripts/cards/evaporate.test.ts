// `Evaporate` — the blue 1/1 Strix dies to the point; the green Bears
// are outside the color filter and untouched.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EVAPORATE_SCRIPT } from './evaporate';
import { EVAPORATE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function evaporated(): { g: Game; strix: InstanceId; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Evaporate'], ['Baleful Strix', 'Grizzly Bears']],
    scripts: createRegistry([EVAPORATE_SCRIPT]),
  });
  const strix = put(g, 'p2', 'Baleful Strix');
  const bears = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Evaporate', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, strix, bears };
}

describe('Evaporate', () => {
  test('the blue 1/1 dies; the green 2/2 is untouched', () => {
    const { g, strix, bears } = evaporated();
    expect(g.state.cards[strix]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[bears]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EVAPORATE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EVAPORATE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EVAPORATE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = evaporated();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
