// `Hour of Glory` — a God takes its hand-twins with it; a non-God keeps
// the hand private.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HOUR_OF_GLORY_SCRIPT } from './hourOfGlory';
import { HOUR_OF_GLORY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function glorified(god: boolean): {
  g: Game;
  target: InstanceId;
  handTwin: InstanceId;
  bystander: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ['Hour of Glory'],
      ['Oketra the True', 'Oketra the True', 'Grizzly Bears', 'Grizzly Bears'],
    ],
    scripts: createRegistry([HOUR_OF_GLORY_SCRIPT]),
  });
  const target = put(g, 'p2', god ? 'Oketra the True' : 'Grizzly Bears');
  const handTwin = put(g, 'p2', god ? 'Oketra the True' : 'Grizzly Bears', 'hand');
  expect(handTwin).not.toBe(target);
  const bystander = put(g, 'p2', god ? 'Grizzly Bears' : 'Oketra the True', 'hand');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Hour of Glory', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target, handTwin, bystander };
}

describe('Hour of Glory', () => {
  test('a God: exiled with its hand-twin, the hand revealed, the bystander kept', () => {
    const { g, target, handTwin, bystander } = glorified(true);
    expect(g.state.cards[target]?.zone.kind).toBe('exile');
    expect(g.state.cards[handTwin]?.zone.kind).toBe('exile');
    expect((g.state.zones.hand['p2'] ?? []).includes(bystander)).toBe(true);
    expect(g.state.cards[bystander]?.revealedTo.includes('p1')).toBe(true);
  });

  test('a non-God: exiled alone, and the hand stays private', () => {
    const { g, target, handTwin, bystander } = glorified(false);
    expect(g.state.cards[target]?.zone.kind).toBe('exile');
    expect((g.state.zones.hand['p2'] ?? []).includes(handTwin)).toBe(true);
    expect(g.state.cards[bystander]?.revealedTo.includes('p1')).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HOUR_OF_GLORY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HOUR_OF_GLORY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HOUR_OF_GLORY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = glorified(true);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
