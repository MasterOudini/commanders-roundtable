// `Corrosive Gale` — X to each FLYER: the Sphinx falls, the ground Bears
// stand.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { CORROSIVE_GALE_SCRIPT } from './corrosiveGale';
import { CORROSIVE_GALE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function galed(): { g: Game; flyer: InstanceId; ground: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Corrosive Gale'], ['Cloudreader Sphinx', 'Grizzly Bears']],
    scripts: createRegistry([CORROSIVE_GALE_SCRIPT]),
  });
  const flyer = put(g, 'p2', 'Cloudreader Sphinx');
  const ground = put(g, 'p2', 'Grizzly Bears');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Corrosive Gale', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'G', amount: 6 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell, xValue: 5 }));
  settle(g);
  return { g, flyer, ground };
}

describe('Corrosive Gale', () => {
  test('X=5 kills the flyer; the ground creature is untouched', () => {
    const { g, flyer, ground } = galed();
    expect(g.state.cards[flyer]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ground]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = CORROSIVE_GALE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, CORROSIVE_GALE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(CORROSIVE_GALE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = galed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
