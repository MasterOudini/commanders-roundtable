// `Honor the Fallen` — creature cards leave EVERY graveyard for exile;
// the artifact card stays; the gain counts what left.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HONOR_THE_FALLEN_SCRIPT } from './honorTheFallen';
import { HONOR_THE_FALLEN } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function honored(): { g: Game; bears: InstanceId; herder: InstanceId; ring: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Honor the Fallen', 'Grizzly Bears', 'Sol Ring'], ['Elvish Herder']],
    scripts: createRegistry([HONOR_THE_FALLEN_SCRIPT]),
  });
  const bears = put(g, 'p1', 'Grizzly Bears', 'graveyard');
  const ring = put(g, 'p1', 'Sol Ring', 'graveyard');
  const herder = put(g, 'p2', 'Elvish Herder', 'graveyard');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Honor the Fallen', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, herder, ring };
}

describe('Honor the Fallen', () => {
  test('both dead creatures are exiled from BOTH graveyards; the Ring stays; gain 2', () => {
    const { g, bears, herder, ring } = honored();
    expect(g.state.cards[bears]?.zone.kind).toBe('exile');
    expect(g.state.cards[herder]?.zone.kind).toBe('exile');
    expect(g.state.cards[ring]?.zone.kind).toBe('graveyard');
    expect(g.state.players['p1']?.life).toBe(42);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HONOR_THE_FALLEN.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HONOR_THE_FALLEN.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HONOR_THE_FALLEN.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = honored();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
