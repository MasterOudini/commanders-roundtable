// `Undo` — the counted pair: BOTH creatures bounce, each to ITS OWNER.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { UNDO_SCRIPT } from './undo';
import { UNDO } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Undo';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function undone(): { g: Game; mine: InstanceId; theirs: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS]],
    scripts: createRegistry([UNDO_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: mine },
        { kind: 'card', id: theirs },
      ],
    }),
  );
  settle(g);
  return { g, mine, theirs };
}

describe('Undo', () => {
  test('both creatures go to THEIR OWN owners hands', () => {
    const { g, mine, theirs } = undone();
    expect(g.state.cards[mine]?.zone.kind).toBe('hand');
    expect(g.state.cards[mine]?.zone.player).toBe('p1');
    expect(g.state.cards[theirs]?.zone.kind).toBe('hand');
    expect(g.state.cards[theirs]?.zone.player).toBe('p2');
  });

  test('ONE target is refused — the spec is exactly two', () => {
    const g = startedGame({
      players: 2,
      decks: [[SPELL, BEARS], [BEARS]],
      scripts: createRegistry([UNDO_SCRIPT]),
    });
    const mine = put(g, 'p1', BEARS);
    put(g, 'p2', BEARS);
    settle(g);
    holdEverywhere(g);
    advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
    const spell = put(g, 'p1', SPELL, 'hand');
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 3 }));
    must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
    advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
    const res = g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [{ kind: 'card', id: mine }],
    });
    expect(res.ok).toBe(false);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = UNDO.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, UNDO.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(UNDO.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = undone();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
