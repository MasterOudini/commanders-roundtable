// `Ahriman` — the chooser's OR-predicate with the "another" exclusion: a
// creature OR an artifact pays, a land never does, and Ahriman itself is
// dropped from its own candidate list before the predicates are asked.

import { describe, expect, test } from 'vitest';
import { faceOf } from '../../oracle';
import { replay, stateHash } from '../../log';
import { createRegistry } from '../registry';
import { legalActions } from '../../legal';
import { AHRIMAN_SCRIPT } from './ahriman';
import { AHRIMAN } from '../../../data/fixtures/engineCards';
import { ORACLE, advanceUntil, idsIn, must, put, startedGame } from '../../testing/harness';
import type { Game } from '../../game';

const EYE = 'Ahriman';
const BEARS = 'Grizzly Bears';
const ARCHIVE = 'Hedron Archive';
const FOUNTAIN = 'Radiant Fountain';

function settle(g: Game): void {
  advanceUntil(g, (s) => s.stack.length === 0 && s.pendingTriggers.length === 0, 20_000);
}

function game(): Game {
  return startedGame({
    players: 2,
    decks: [[EYE, BEARS, ARCHIVE, FOUNTAIN], []],
    scripts: createRegistry([AHRIMAN_SCRIPT]),
  });
}

describe('Ahriman', () => {
  test('the parse says what the machinery assumes: "another", one predicate per OR arm', () => {
    const oc = ORACLE.byPrinting(AHRIMAN.scryfallId);
    const abilities = faceOf(oc!, 0).activated;
    // The keyword line has no colon, so the sacrifice line is ability 0.
    expect(abilities).toHaveLength(1);
    expect(abilities[0]?.payable).toBe(true);
    expect(abilities[0]?.sacrificeCost).toEqual({
      another: true,
      any: [
        { supertypes: [], types: ['Creature'], subtypes: [], colors: [] },
        { supertypes: [], types: ['Artifact'], subtypes: [], colors: [] },
      ],
    });
  });

  test('candidates are the OTHER creature and the artifact — never Ahriman, never a land', () => {
    const g = game();
    const eye = put(g, 'p1', EYE);
    const bears = put(g, 'p1', BEARS);
    const archive = put(g, 'p1', ARCHIVE);
    put(g, 'p1', FOUNTAIN);
    settle(g);
    const offer = legalActions(g.state, ORACLE, g.deps.scripts, 'p1').find(
      (a) => a.t === 'ActivateAbility' && a.card === eye,
    );
    const candidates =
      offer?.t === 'ActivateAbility' ? [...(offer.sacrificeCandidates ?? [])].sort() : null;
    expect(candidates).toEqual([bears, archive].sort());
  });

  test('the ARTIFACT arm of the OR pays, and the draw arrives', () => {
    const g = game();
    const eye = put(g, 'p1', EYE);
    const archive = put(g, 'p1', ARCHIVE);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const handBefore = idsIn(g, 'p1', 'hand').length;
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eye, abilityIndex: 0, sacrifice: archive }));
    expect(g.state.cards[archive]?.zone.kind).toBe('graveyard');
    settle(g);
    expect(idsIn(g, 'p1', 'hand').length).toBe(handBefore + 1);
    expect(g.state.cards[eye]?.zone.kind).toBe('battlefield');
  });

  test('"another" refuses Ahriman itself, even though Ahriman is a creature', () => {
    const g = game();
    const eye = put(g, 'p1', EYE);
    put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    const r = g.submit({ t: 'ActivateAbility', player: 'p1', card: eye, abilityIndex: 0, sacrifice: eye });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toBe('illegalSacrifice');
    expect(g.state.cards[eye]?.zone.kind).toBe('battlefield');
  });

  test('replays to the same hash', () => {
    const g = game();
    const eye = put(g, 'p1', EYE);
    const bears = put(g, 'p1', BEARS);
    settle(g);
    must(g.submit({ t: 'ManualAddMana', player: 'p1', target: 'p1', symbol: 'C', amount: 3 }));
    must(g.submit({ t: 'ActivateAbility', player: 'p1', card: eye, abilityIndex: 0, sacrifice: bears }));
    settle(g);
    advanceUntil(g, (s) => s.turn.turnNumber >= 3, 20_000);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });
});
