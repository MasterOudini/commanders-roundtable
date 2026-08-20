// `Eyeblight Massacre` — the non-Elf 2/2 dies; the Elf survives the sweep
// entirely.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { EYEBLIGHT_MASSACRE_SCRIPT } from './eyeblightMassacre';
import { EYEBLIGHT_MASSACRE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function massacred(): { g: Game; bears: InstanceId; elf: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Eyeblight Massacre'], ['Grizzly Bears', 'Elvish Herder']],
    scripts: createRegistry([EYEBLIGHT_MASSACRE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const elf = put(g, 'p2', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Eyeblight Massacre', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, elf };
}

describe('Eyeblight Massacre', () => {
  test('the non-Elf 2/2 dies; the 1/1 ELF is exempt and lives', () => {
    const { g, bears, elf } = massacred();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[elf]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = EYEBLIGHT_MASSACRE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, EYEBLIGHT_MASSACRE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(EYEBLIGHT_MASSACRE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = massacred();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
