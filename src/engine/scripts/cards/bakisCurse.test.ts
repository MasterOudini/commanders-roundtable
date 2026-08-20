// `Baki's Curse` — 2 damage per attached Aura, per creature: the enchanted
// Bears take 2 and die, the bare Dreadmaw takes nothing. The Aura arrives
// by a REAL cast (CR 303.4g, D198).

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { BAKIS_CURSE_SCRIPT } from './bakisCurse';
import { BAKI_S_CURSE } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function cursed(): { g: Game; bears: InstanceId; maw: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [["Baki's Curse", 'Pacifism'], ['Grizzly Bears', 'Colossal Dreadmaw']],
    scripts: createRegistry([BAKIS_CURSE_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const maw = put(g, 'p2', 'Colossal Dreadmaw');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const aura = put(g, 'p1', 'Pacifism', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  const spell = put(g, 'p1', "Baki's Curse", 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 4 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  settle(g);
  return { g, bears, maw };
}

describe("Baki's Curse", () => {
  test('the enchanted 2/2 dies of its one Aura; the bare 6/6 takes nothing', () => {
    const { g, bears, maw } = cursed();
    expect(g.state.cards[bears]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[maw]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[maw]?.damage ?? 0).toBe(0);
  });

  test('the suppression predicate holds (D187)', () => {
    const text = BAKI_S_CURSE.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, BAKI_S_CURSE.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(BAKI_S_CURSE.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = cursed();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
