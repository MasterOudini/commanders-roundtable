// `Thunder of Hooves` — X censused off EVERY Beast on the battlefield, fanned
// at non-flyers and at every player. No Beasts is a true no-op.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { THUNDER_OF_HOOVES_SCRIPT } from './thunderOfHooves';
import { THUNDER_OF_HOOVES } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const SPELL = 'Thunder of Hooves';
const BEAST = 'Aquus Steed'; // already a fixture — a plain Creature — Beast
const FLYER = 'Air Elemental';
const GROUND = 'Grizzly Bears';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function thundered(beasts: number): { g: Game; flyer: InstanceId; ground: InstanceId } {
  const deck = [SPELL, FLYER, GROUND];
  for (let i = 0; i < beasts; i++) deck.push(BEAST);
  const g = startedGame({
    players: 2,
    decks: [deck, []],
    scripts: createRegistry([THUNDER_OF_HOOVES_SCRIPT]),
  });
  const flyer = put(g, 'p1', FLYER);
  const ground = put(g, 'p1', GROUND);
  for (let i = 0; i < beasts; i++) put(g, 'p1', BEAST);
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', SPELL, 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'R', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, flyer, ground };
}

describe('Thunder of Hooves', () => {
  test('THREE Beasts: the ground 2/2 dies, the flyer stands, both players take 3', () => {
    const { g, flyer, ground } = thundered(3);
    expect(g.state.cards[ground]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[flyer]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(37);
    expect(g.state.players.p2?.life).toBe(37);
  });

  test('no Beasts is a true no-op', () => {
    const { g, ground } = thundered(0);
    expect(g.state.cards[ground]?.zone.kind).toBe('battlefield');
    expect(g.state.players.p1?.life).toBe(40);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = THUNDER_OF_HOOVES.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, THUNDER_OF_HOOVES.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(THUNDER_OF_HOOVES.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = thundered(3);
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
