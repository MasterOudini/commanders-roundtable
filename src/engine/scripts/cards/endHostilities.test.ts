// `End Hostilities` — the creature dies and the Equipment ON it dies with
// it; the unattached Equipment stands.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { END_HOSTILITIES_SCRIPT } from './endHostilities';
import { END_HOSTILITIES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ended(): { g: Game; bears: InstanceId; worn: InstanceId; spare: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['End Hostilities'],
      ['Grizzly Bears', 'Lightning Greaves', 'Lightning Greaves'],
    ],
    scripts: createRegistry([END_HOSTILITIES_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const worn = put(g, 'p2', 'Lightning Greaves');
  const spare = put(g, 'p2', 'Lightning Greaves');
  expect(spare).not.toBe(worn);
  must(g.submit({ t: 'ManualAttach', player: 'p2', card: worn, to: bears }));
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'End Hostilities', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, worn, spare };
}

describe('End Hostilities', () => {
  test('the creature and its worn Equipment die; the spare stands', () => {
    const { g, bears, worn, spare } = ended();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[worn]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[spare]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = END_HOSTILITIES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, END_HOSTILITIES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(END_HOSTILITIES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
