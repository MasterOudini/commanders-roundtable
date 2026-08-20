// `Disorder` — the white 3/2 dies and its controller takes 2; the green
// side is untouched on both halves.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DISORDER_SCRIPT } from './disorder';
import { DISORDER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function disordered(): { g: Game; white: InstanceId; green: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Disorder', 'Grizzly Bears'], ['Angelheart Protector']],
    scripts: createRegistry([DISORDER_SCRIPT]),
  });
  const green = put(g, 'p1', 'Grizzly Bears');
  const white = put(g, 'p2', 'Angelheart Protector');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Disorder', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, white, green };
}

describe('Disorder', () => {
  test('the white 3/2 dies; its controller takes 2; the green side is untouched', () => {
    const { g, white, green } = disordered();
    expect(g.state.cards[white]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[green]?.zone.kind).toBe('battlefield');
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DISORDER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DISORDER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DISORDER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = disordered();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
