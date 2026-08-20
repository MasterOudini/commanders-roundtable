// `Deluge of Doom` — X counts DISTINCT card types in MY graveyard: a
// creature card and a land card make X = 2, killing the 2/2 everywhere
// while the 6/6 reads derived power 4.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { DELUGE_OF_DOOM_SCRIPT } from './delugeOfDoom';
import { DELUGE_OF_DOOM } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function doomed(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Deluge of Doom', 'Grizzly Bears', 'Swamp'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([DELUGE_OF_DOOM_SCRIPT]),
  });
  put(g, 'p1', 'Grizzly Bears', 'graveyard');
  put(g, 'p1', 'Swamp', 'graveyard');
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Deluge of Doom', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 3 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe('Deluge of Doom', () => {
  test('X = 2 (creature + land in the graveyard): the 2/2 dies, the 6/6 reads 4', () => {
    const { g, bears, maw } = doomed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, maw).power).toBe(4);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = DELUGE_OF_DOOM.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, DELUGE_OF_DOOM.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(DELUGE_OF_DOOM.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = doomed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
