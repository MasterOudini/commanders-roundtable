// `Rending Vines` — a mana-value-1 artifact dies to a full hand; with my
// hand emptied first it survives, and the card still comes.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { RENDING_VINES_SCRIPT } from './rendingVines';
import { RENDING_VINES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Rending Vines';
const SPELLBOMB = 'Aether Spellbomb'; // an artifact of mana value 1

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  let n = 0;
  for (const e of g.log.slice(from)) {
    if (e.body.t !== 'CardsMoved') continue;
    n += e.body.moves.filter((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player).length;
  }
  return n;
}

function cast(emptyHand: boolean): { g: Game; bomb: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [SPELLBOMB]],
    scripts: createRegistry([RENDING_VINES_SCRIPT]),
  });
  const bomb = put(g, 'p2', SPELLBOMB);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  if (emptyHand) {
    for (const id of [...(g.state.zones.hand['p1'] ?? [])]) {
      must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: id, to: { kind: 'graveyard', player: 'p1' } }));
    }
    expect((g.state.zones.hand['p1'] ?? []).length).toBe(0);
  }
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 2 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bomb }] }));
  settle(g);
  return { g, bomb, logAt };
}

describe('Rending Vines', () => {
  test('mana value 1 against a full hand: destroyed, and I draw', () => {
    const { g, bomb, logAt } = cast(false);
    expect(g.state.cards[bomb]?.zone.kind).toBe('graveyard');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('mana value 1 against an empty hand: it survives, and I still draw', () => {
    const { g, bomb, logAt } = cast(true);
    expect(g.state.cards[bomb]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = RENDING_VINES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, RENDING_VINES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(RENDING_VINES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cast(false);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
