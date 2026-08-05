// `Ark of Blight` — a targeted self-sacrifice: the Ark is spent at activation
// (D159's cost batch), the land dies at resolution, and Darksteel Citadel is
// the indestructible break carried by a real card.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { ARK_OF_BLIGHT_SCRIPT } from './arkOfBlight';
import { ARK_OF_BLIGHT } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const ARK = 'Ark of Blight';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(landName: string): { g: Game; ark: InstanceId; land: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[ARK], [landName]],
    scripts: createRegistry([ARK_OF_BLIGHT_SCRIPT]),
  });
  const land = put(g, 'p2', landName);
  const ark = put(g, 'p1', ARK);
  settle(g);
  must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
  return { g, ark, land };
}

describe('Ark of Blight', () => {
  test('the parse says what the def assumes: one ability, self-sacrifice, one target', () => {
    const oc = ORACLE.byPrinting(ARK_OF_BLIGHT.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.sacrificesSelf).toBe(true);
    expect(abilities[0]?.targets).toHaveLength(1);
  });

  test('destroys the targeted land, with the Ark spent as part of the cost', () => {
    const { g, ark, land } = game('Mountain');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ark,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: land }],
      }),
    );
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[ark]?.zone.kind).toBe('graveyard');
  });

  test('an INDESTRUCTIBLE land survives — Darksteel Citadel keeps its ground', () => {
    const { g, ark, land } = game('Darksteel Citadel');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ark,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: land }],
      }),
    );
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('battlefield');
    // The cost was still paid — the Ark does not come back for a no-op.
    expect(g.state.cards[ark]?.zone.kind).toBe('graveyard');
  });

  test('replays to the same hash', () => {
    const { g, ark, land } = game('Mountain');
    must(
      g.submit({
        t: 'ActivateAbility',
        player: 'p1',
        card: ark,
        abilityIndex: 0,
        targets: [{ kind: 'card', id: land }],
      }),
    );
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
