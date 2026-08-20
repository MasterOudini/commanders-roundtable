// `Hubris` — the bounce routes by OWNER: the creature goes to its
// owner's hand and MY Aura riding it comes back to mine; an Aura on
// somebody else stays. Both Auras are CAST (D198's attach path) — a
// put() Aura is unattached for one SBA sweep and dies before any
// Tier-3 attach can land.

import { describe, expect, test } from 'vitest';
import { replay, stateHash } from '../../log';
import { createRegistry, SHIPPED_REGISTRY } from '../registry';
import { HUBRIS_SCRIPT } from './hubris';
import { HUBRIS } from '../../../data/fixtures/engineCards';
import { parseEffects } from '../../../data/effectParse';
import { advanceUntil, holdEverywhere, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function castPacifism(g: Game, onto: InstanceId): InstanceId {
  const aura = put(g, 'p1', 'Pacifism', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'W', amount: 2 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: aura }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: onto }] }));
  settle(g);
  return aura;
}

function humbled(): {
  g: Game;
  bears: InstanceId;
  worn: InstanceId;
  other: InstanceId;
} {
  const g = startedGame({
    players: 2,
    decks: [['Hubris', 'Pacifism', 'Pacifism', 'Elvish Herder'], ['Grizzly Bears']],
    scripts: createRegistry([HUBRIS_SCRIPT]),
  });
  const bears = put(g, 'p2', 'Grizzly Bears');
  const herder = put(g, 'p1', 'Elvish Herder');
  settle(g);
  holdEverywhere(g);
  advanceUntil(g, (s) => s.turn.activePlayer === 'p1' && s.turn.phase === 'precombatMain', 60_000);
  const worn = castPacifism(g, bears);
  const other = castPacifism(g, herder);
  expect(other).not.toBe(worn);
  expect(g.state.cards[worn]?.attachedTo).toBe(bears);
  const spell = put(g, 'p1', 'Hubris', 'hand');
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'U', amount: 1 }));
  must(g.submit({ t: 'CastSpell', player: 'p1', card: spell }));
  advanceUntil(g, (s) => s.priority.awaiting?.kind === 'chooseTargets', 20_000);
  must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: bears }] }));
  settle(g);
  return { g, bears, worn, other };
}

describe('Hubris', () => {
  test("the creature and ITS Aura go to their OWN owners' hands; the other Aura stays", () => {
    const { g, bears, worn, other } = humbled();
    expect((g.state.zones.hand['p2'] ?? []).includes(bears)).toBe(true);
    expect((g.state.zones.hand['p1'] ?? []).includes(worn)).toBe(true);
    expect(g.state.cards[other]?.zone.kind).toBe('battlefield');
  });

  test('the suppression predicate holds (D187)', () => {
    const text = HUBRIS.faces[0]?.oracleText ?? '';
    expect(parseEffects(text, HUBRIS.name, true).mode).not.toBe('auto');
    expect(SHIPPED_REGISTRY.spell(HUBRIS.oracleId)).toBeDefined();
  });

  test('replays to the same hash', () => {
    const { g } = humbled();
    advanceUntil(g, (s) => s.turn.turnNumber >= 2, 60_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
