// D342 - an ENGINE HOLE the port's own proof found: an ordinary activated
// ability was ACCEPTED with its source in the graveyard. `legal.ts` never
// offered it, but the handler required a zone only for cycling (the hand) and
// the graveyard activations (D329/D333); a hand-built intent on a card anywhere
// else went straight to payment. Cryptic Caves - "{1}, {T}, Sacrifice this
// land: Draw a card." - was activated twice by the D342 proof: the first
// sacrificed it, the second drew a card from the graveyard. CR 602.2: an
// activated ability of a permanent is activated from the battlefield.
import { describe, expect, test } from 'vitest';
import { createRegistry } from './scripts/registryCore';
import { CRYPTIC_CAVES_SCRIPT } from './scripts/cards/crypticCaves';
import { advanceUntil, holdEverywhere, must, put, startedGame } from './testing/harness';

describe('D342 - an ordinary ability is activated from the battlefield', () => {
  test('a card in the graveyard is refused by zone, before any cost', () => {
    const g = startedGame({
      players: 2,
      decks: [['Cryptic Caves', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest', 'Forest'], ['Grizzly Bears']],
      scripts: createRegistry([CRYPTIC_CAVES_SCRIPT]),
    });
    holdEverywhere(g);
    for (let i = 0; i < 6; i++) put(g, 'p1', 'Forest');
    const caves = put(g, 'p1', 'Cryptic Caves', 'graveyard');
    advanceUntil(g, (s) => s.turn.turnNumber === 3 && s.turn.phase === 'precombatMain' && s.priority.player === 'p1' && s.priority.awaiting === null, 20_000);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    const hand0 = (g.state.zones.hand.p1 ?? []).length;
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: caves, abilityIndex: 1 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('wrongZone');
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0);
    expect(g.state.cards[caves]?.zone.kind).toBe('graveyard');
    // On the battlefield the same intent is accepted, the six Forests satisfying its condition.
    must(g.submit({ t: 'ManualMoveCard', player: 'p1', card: caves, to: { kind: 'battlefield', player: 'p1' } }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: caves, abilityIndex: 1 }));
    advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
    expect((g.state.zones.hand.p1 ?? []).length).toBe(hand0 + 1);
    expect(g.state.cards[caves]?.zone.kind).toBe('graveyard');
  });
});
