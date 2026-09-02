// `Cunning Strike` — 2 to the creature (a 2/2 dies), 2 to the player, and
// I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CUNNING_STRIKE_SCRIPT } from './cunningStrike';
import { CUNNING_STRIKE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Cunning Strike';
const BEARS = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function drawsFor(g: Game, player: string, from: number): number {
  return g.log
    .slice(from)
    .filter(
      (e) =>
        e.body.t === 'CardsMoved' &&
        e.body.moves.some((m) => m.from.kind === 'library' && m.to.kind === 'hand' && m.to.player === player),
    ).length;
}

function struck(): { g: Game; bears: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL], [BEARS]],
    scripts: createRegistry([CUNNING_STRIKE_SCRIPT]),
  });
  const bears = put(g, 'p2', BEARS);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(
    g.submit({
      t: 'ChooseTargets',
      player: 'p1',
      targets: [
        { kind: 'card', id: bears },
        { kind: 'player', id: 'p2' },
      ],
    }),
  );
  settle(g);
  return { g, bears, logAt };
}

describe('Cunning Strike', () => {
  test('the 2/2 dies, the player takes 2, I draw', () => {
    const { g, bears, logAt } = struck();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p2']?.life).toBe(38);
    expect(g.state.players['p1']?.life).toBe(40);
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CUNNING_STRIKE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CUNNING_STRIKE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CUNNING_STRIKE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = struck();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
