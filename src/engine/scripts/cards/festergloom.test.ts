// `Festergloom` — the nonblack 1/1 Elf dies; the black Zombie is exempt.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FESTERGLOOM_SCRIPT } from './festergloom';
import { FESTERGLOOM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function gloomed(): { g: Game; elf: InstanceId; rider: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Festergloom'], ['Elvish Herder', 'Headless Rider']],
    scripts: createRegistry([FESTERGLOOM_SCRIPT]),
  });
  const elf = put(g, 'p2', 'Elvish Herder');
  const rider = put(g, 'p2', 'Headless Rider');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Festergloom', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, elf, rider };
}

describe('Festergloom', () => {
  test('the nonblack 1/1 dies; the BLACK Zombie is exempt', () => {
    const { g, elf, rider } = gloomed();
    expect(g.state.cards[elf]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[rider]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FESTERGLOOM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FESTERGLOOM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FESTERGLOOM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = gloomed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
