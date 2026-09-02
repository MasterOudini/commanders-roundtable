// `Blinding Spray` — every opponent creature loses 4 power until cleanup,
// mine keep theirs, and I draw.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BLINDING_SPRAY_SCRIPT } from './blindingSpray';
import { BLINDING_SPRAY } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, deps, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import { derive } from '../../derive';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Blinding Spray';
const BEARS = 'Grizzly Bears';
const TITAN = 'Grave Titan'; // 6/6

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

function sprayed(): { g: Game; mine: InstanceId; theirs: InstanceId; titan: InstanceId; logAt: number } {
  const g = startedGame({
    players: 2,
    decks: [[SPELL, BEARS], [BEARS, TITAN]],
    scripts: createRegistry([BLINDING_SPRAY_SCRIPT]),
  });
  const mine = put(g, 'p1', BEARS);
  const theirs = put(g, 'p2', BEARS);
  const titan = put(g, 'p2', TITAN);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 4 }));
  const logAt = g.log.length;
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, mine, theirs, titan, logAt };
}

function pt(g: Game, id: InstanceId): { power: number | null; toughness: number | null } {
  const d = deps(createRegistry([BLINDING_SPRAY_SCRIPT]));
  const got = derive(g.state, d.oracle, d.scripts, id);
  return { power: got.power, toughness: got.toughness };
}

describe('Blinding Spray', () => {
  test('opponent creatures get -4/-0, mine do not, and I draw', () => {
    const { g, mine, theirs, titan, logAt } = sprayed();
    expect(pt(g, theirs)).toEqual({ power: -2, toughness: 2 });
    expect(pt(g, titan)).toEqual({ power: 2, toughness: 6 });
    expect(pt(g, mine)).toEqual({ power: 2, toughness: 2 });
    expect(g.state.cards[theirs]?.zone.kind).toBe('battlefield');
    expect(drawsFor(g, 'p1', logAt)).toBe(1);
  });

  test('cleanup gives the power back (CR 514.2)', () => {
    const { g, theirs, titan } = sprayed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(pt(g, theirs)).toEqual({ power: 2, toughness: 2 });
    expect(pt(g, titan)).toEqual({ power: 6, toughness: 6 });
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BLINDING_SPRAY.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BLINDING_SPRAY.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BLINDING_SPRAY.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = sprayed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
