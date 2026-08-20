// `Glistening Deluge` — the green 2/2 takes the extra -2/-2 and dies;
// the black 6/6 takes only -1/-1 and reads 5/5.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { derive } from '../../derive';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { GLISTENING_DELUGE_SCRIPT } from './glisteningDeluge';
import { GLISTENING_DELUGE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { ORACLE, advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function deluged(): { g: Game; bears: InstanceId; whisperer: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Glistening Deluge'], ['Grizzly Bears', 'Doom Whisperer']],
    scripts: createRegistry([GLISTENING_DELUGE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const whisperer = put(g, 'p2', 'Doom Whisperer');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const spell = put(g, 'p1', 'Glistening Deluge', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'B', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, whisperer };
}

describe('Glistening Deluge', () => {
  test('the green 2/2 dies to -3/-3; the black 6/6 reads 5/5', () => {
    const { g, bears, whisperer } = deluged();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[whisperer]?.zone.kind).toBe('battlefield');
    expect(derive(g.state, ORACLE, g.deps.scripts, whisperer).power).toBe(5);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = GLISTENING_DELUGE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, GLISTENING_DELUGE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(GLISTENING_DELUGE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = deluged();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
