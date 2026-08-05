// `Claws of Gix` — the chooser's WIDEST predicate: "a permanent" is the empty
// predicate, so a land pays it and so do the Claws THEMSELVES — the
// self-inclusion mirror of Ahriman's "another", and the proof the ability
// still resolves once paying it destroyed its own source (CR 113.7a).

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { CLAWS_OF_GIX_SCRIPT } from './clawsOfGix';
import { CLAWS_OF_GIX } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const CLAWS = 'Claws of Gix';
const FOUNTAIN = 'Radiant Fountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[CLAWS, FOUNTAIN], []],
    scripts: createRegistry([CLAWS_OF_GIX_SCRIPT]),
  });
}

describe('Claws of Gix', () => {
  test('the parse says what the machinery assumes: "a permanent" is the empty predicate', () => {
    const oc = ORACLE.byPrinting(CLAWS_OF_GIX.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.sacrificeCost).toEqual({
      another: false,
      any: [{ supertypes: [], types: [], subtypes: [], colors: [] }],
    });
  });

  test('every permanent is a candidate — a land, and the Claws themselves', () => {
    const g = game();
    const claws = put(g, 'p1', CLAWS);
    const fountain = put(g, 'p1', FOUNTAIN);
    settle(g);
    const offer = legalActions(g.state, ORACLE, g.deps.scripts, 'p1').find(
      (a) => a.t === 'ActivateAbility' && a.card === claws,
    );
    const candidates =
      offer?.t === 'ActivateAbility' ? [...(offer.sacrificeCandidates ?? [])].sort() : null;
    expect(candidates).toEqual([claws, fountain].sort());
  });

  test('a LAND pays "a permanent", and the life arrives', () => {
    const g = game();
    const claws = put(g, 'p1', CLAWS);
    const fountain = put(g, 'p1', FOUNTAIN);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: claws, abilityIndex: 0, sacrifice: fountain }));
    expect(g.state.cards[fountain]?.zone.kind).toBe('graveyard');
    settle(g);
    // 40 to start, +1 from the Claws. The Fountain's own ETB gain needs ITS
    // script, which this registry deliberately does not carry.
    expect(g.state.players['p1']?.life).toBe(41);
    expect(g.state.cards[claws]?.zone.kind).toBe('battlefield');
  });

  test('the Claws pay their OWN cost and the ability still resolves (CR 113.7a)', () => {
    const g = game();
    const claws = put(g, 'p1', CLAWS);
    settle(g);
    const lifeBefore = g.state.players['p1']?.life ?? 0;
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: claws, abilityIndex: 0, sacrifice: claws }));
    // The source is gone the moment the cost is paid…
    expect(g.state.cards[claws]?.zone.kind).toBe('graveyard');
    settle(g);
    // …and the ability on the stack still gains the life.
    expect(g.state.players['p1']?.life).toBe(lifeBefore + 1);
  });

  test('replays to the same hash', () => {
    const g = game();
    const claws = put(g, 'p1', CLAWS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 1 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: claws, abilityIndex: 0, sacrifice: claws }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
