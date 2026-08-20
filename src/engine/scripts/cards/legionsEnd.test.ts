// `Legion's End` — the target, its battlefield twin, its hand twin, and
// its graveyard twin all leave for exile; the bystander card stays and
// the hand goes public.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { LEGIONS_END_SCRIPT } from './legionsEnd';
import { LEGION_S_END } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function ended(): {
  g: Game;
  target: InstanceId;
  twin: InstanceId;
  handTwin: InstanceId;
  graveTwin: InstanceId;
  bystander: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [
      ["Legion's End"],
      [
        'Grizzly Bears',
        'Grizzly Bears',
        'Grizzly Bears',
        'Grizzly Bears',
        'Elvish Herder',
      ],
    ],
    scripts: createRegistry([LEGIONS_END_SCRIPT]),
  });
  const target = put(g, 'p2', 'Grizzly Bears');
  const twin = put(g, 'p2', 'Grizzly Bears');
  const handTwin = put(g, 'p2', 'Grizzly Bears', 'hand');
  const graveTwin = put(g, 'p2', 'Grizzly Bears', 'graveyard');
  const bystander = put(g, 'p2', 'Elvish Herder', 'hand');
  expect(new Set([target, twin, handTwin, graveTwin]).size).toBe(4);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', "Legion's End", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: target }] }));
  settle(g);
  return { g, target, twin, handTwin, graveTwin, bystander };
}

describe("Legion's End", () => {
  test('all four namesakes exile from three zones; the bystander stays, revealed', () => {
    const { g, target, twin, handTwin, graveTwin, bystander } = ended();
    expect(g.state.cards[target]?.zone.kind).toBe('exile');
    expect(g.state.cards[twin]?.zone.kind).toBe('exile');
    expect(g.state.cards[handTwin]?.zone.kind).toBe('exile');
    expect(g.state.cards[graveTwin]?.zone.kind).toBe('exile');
    expect((g.state.zones.hand['p2'] ?? []).includes(bystander)).toBe(true);
    expect(g.state.cards[bystander]?.revealedTo.includes('p1')).toBe(true);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = LEGION_S_END.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, LEGION_S_END.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(LEGION_S_END.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = ended();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
