// `Aura Fracture` — the chooser cost with NO mana at all: the land IS the
// whole price, and the destroy answers to the derived target.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { AURA_FRACTURE_SCRIPT } from './auraFracture';
import { AURA_FRACTURE } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';
import type { InstanceId } from '../../types/ids';

const FRACTURE = 'Aura Fracture';
const FOUNTAIN = 'Radiant Fountain';
const MANTRA = "Ajani's Mantra";

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): { g: Game; fracture: InstanceId; land: InstanceId; mantra: InstanceId } {
  const g = startedGame({
    players: 2,
    decks: [[FRACTURE, FOUNTAIN], [MANTRA]],
    scripts: createRegistry([AURA_FRACTURE_SCRIPT]),
  });
  const fracture = put(g, 'p1', FRACTURE);
  const land = put(g, 'p1', FOUNTAIN);
  const mantra = put(g, 'p2', MANTRA);
  settle(g);
  return { g, fracture, land, mantra };
}

describe('Aura Fracture', () => {
  test('the parse: a sacrifice-only cost is payable with ZERO mana symbols', () => {
    const oc = ORACLE.byPrinting(AURA_FRACTURE.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.manaCost).toBeNull();
    expect(abilities[0]?.sacrificeCost).toEqual({
      another: false,
      any: [{ supertypes: [], types: ['Land'], subtypes: [], colors: [] }],
    });
  });

  test('the land alone pays, and the enchantment dies — no mana funded anywhere', () => {
    const { g, fracture, land, mantra } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fracture, abilityIndex: 0, sacrifice: land }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mantra }] }));
    settle(g);
    expect(g.state.cards[land]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[mantra]?.zone.kind).toBe('graveyard');
    expect(g.state.cards[fracture]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const { g, fracture, land, mantra } = game();
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: fracture, abilityIndex: 0, sacrifice: land }));
    must(g.submit({ t: 'ChooseTargets', player: 'p1', targets: [{ kind: 'card', id: mantra }] }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
