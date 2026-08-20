// `Flames of the Raze-Boar` — with a 6/6 on my side the fan fires (4 at
// the target, 2 at the bystander); without it only the target burns.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { FLAMES_OF_THE_RAZE_BOAR_SCRIPT } from './flamesOfTheRazeBoar';
import { FLAMES_OF_THE_RAZE_BOAR } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function flamed(big: boolean): { g: Game; victim: InstanceId; bystander: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [
      ['Flames of the Raze-Boar', 'Colossal Dreadmaw'],
      ['Colossal Dreadmaw', 'Baleful Strix'],
    ],
    scripts: createRegistry([FLAMES_OF_THE_RAZE_BOAR_SCRIPT]),
  });
  if (big) put(g, 'p1', 'Colossal Dreadmaw');
  const victim = put(g, 'p2', 'Colossal Dreadmaw');
  const bystander = put(g, 'p2', 'Baleful Strix');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Flames of the Raze-Boar', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: victim }] }));
  settle(g);
  return { g, victim, bystander };
}

describe('Flames of the Raze-Boar', () => {
  test('with my 6/6 the fan fires: the 1/1 bystander dies too', () => {
    const { g, bystander } = flamed(true);
    expect(g.state.cards[bystander]?.zone.kind).toBe('graveyard');
  });

  test('without a power-4 creature only the target burns', () => {
    const { g, bystander } = flamed(false);
    expect(g.state.cards[bystander]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = FLAMES_OF_THE_RAZE_BOAR.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, FLAMES_OF_THE_RAZE_BOAR.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(FLAMES_OF_THE_RAZE_BOAR.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = flamed(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
