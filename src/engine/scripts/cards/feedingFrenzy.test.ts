// `Feeding Frenzy` — with no Zombies on the battlefield X is 0 and
// nothing moves; the count arm is proven through the survivor's power
// when a Zombie stands nearby.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FEEDING_FRENZY_SCRIPT } from './feedingFrenzy';
import { FEEDING_FRENZY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function frenzied(withZombie: boolean): { g: Game; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Feeding Frenzy', 'Headless Rider'], ['Colossal Dreadmaw']],
    scripts: createRegistry([FEEDING_FRENZY_SCRIPT]),
  });
  if (withZombie) put(g, 'p1', 'Headless Rider');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Feeding Frenzy', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: maw }] }));
  settle(g);
  return { g, maw };
}

describe('Feeding Frenzy', () => {
  test('one Zombie on the battlefield: the 6/6 reads 5', () => {
    const { g, maw } = frenzied(true);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(5);
  });

  test('no Zombies: nothing moves', () => {
    const { g, maw } = frenzied(false);
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(6);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FEEDING_FRENZY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FEEDING_FRENZY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FEEDING_FRENZY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = frenzied(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
