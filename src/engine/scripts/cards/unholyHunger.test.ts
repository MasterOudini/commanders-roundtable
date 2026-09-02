// `Unholy Hunger` — the target creature dies; with two instants or sorceries
// in my graveyard I gain 2, with none I gain nothing.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNHOLY_HUNGER_SCRIPT } from './unholyHunger';
import { UNHOLY_HUNGER } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Unholy Hunger';
const BEARS = 'Grizzly Bears';
const SNUFF = 'Spell Snuff';
const SIGHT = 'Sorcerous Sight';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function hungry(mastery: boolean): { g: Game; bears: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, SNUFF, SIGHT], [BEARS]],
    scripts: createRegistry([UNHOLY_HUNGER_SCRIPT]),
  });
  settle(g);
  holdEverywhere(g);
  const bears = put(g, 'p2', BEARS);
  if (mastery) {
    put(g, 'p1', SNUFF, 'graveyard');
    put(g, 'p1', SIGHT, 'graveyard');
  }
  settle(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain' && s.priority.awaiting === null, 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears };
}

describe('Unholy Hunger', () => {
  test('no spells in my graveyard: the bear dies, no life', () => {
    const { g, bears } = hungry(false);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.players['p1']?.life).toBe(40);
  });

  test('two spells in my graveyard: the bear dies and I gain 2', () => {
    const { g, bears } = hungry(true);
    expect(g.state.cards[bears]?.zone).toEqual({ kind: 'graveyard', player: 'p2' });
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNHOLY_HUNGER.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNHOLY_HUNGER.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNHOLY_HUNGER.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = hungry(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
