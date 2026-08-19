// `Slash the Ranks` — the commander exemption read off `commanderIds`: an
// opposing commander ON the battlefield survives the wipe its bodyguard
// dies to.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { SLASH_THE_RANKS_SCRIPT } from './slashTheRanks';
import { SLASH_THE_RANKS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function board(): { g: Game; bears: InstanceId; cmdr: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [['Slash the Ranks'], ['Grizzly Bears']],
    scripts: createRegistry([SLASH_THE_RANKS_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  // The opponent's commander onto the battlefield — by INSTANCE, the way the
  // exemption reads it.
  const cmdr = g.state.players['p2']?.commanderIds[0] as InstanceId;
  must(g.submit({ t: 'ManualMoveCard', player: 'p2', card: cmdr, to: { kind: 'battlefield', player: 'p2' } }));
  settle(g);
  const wrath = put(g, 'p1', 'Slash the Ranks', 'hand');
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 20_000);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 5 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: wrath }));
  settle(g);
  return { g, bears, cmdr };
}

describe('Slash the Ranks', () => {
  test('the Bears die; the commander stands', () => {
    const { g, bears, cmdr } = board();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[cmdr]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = SLASH_THE_RANKS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, SLASH_THE_RANKS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(SLASH_THE_RANKS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = board();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
