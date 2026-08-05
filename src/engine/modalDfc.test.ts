// CR 712 — a modal double-faced card played as its BACK face. See D155.
//
// ⚠️⚠️ WHAT WAS BROKEN, and it was Tier 1 in the shipped app: `castSpell` opened
// with `const faceIndex = 0` and `playLand` read `faceOf(oracleCard, 0)`, while
// `legalActions` had been OFFERING every castable face since M3. So the back
// face of all **98** Commander-legal modal DFCs was listed, clickable, and
// played as the FRONT face — and with it, the second half of 123 split cards and
// 134 adventures, because the click path took `legal.find(…)`, the first match.
//
// ⚠️ It also silently disabled three rules that had been built and tested.
// D134's "enters tapped", D135's conditions and D136's pay-to-enter prompt all
// read the entering card's face, and no back face could ever reach them —
// D136's own reportable described this as the entry rules failing to SEE a back
// face, which was the symptom rather than the cause.
//
// ⚠️ THE FIXTURE POOL HAD NO `modal_dfc` AT ALL, which is why every suite stayed
// green: 121 normal, 2 split, 4 token, 5 transform. Fifth time in this repo that
// a fixture which cannot reach a path is how the path rotted (D102).

import { describe, expect, test } from 'vitest';
import { Game } from './game';
import { replay, stateHash } from './log';
import { legalActions } from './legal';
import { NO_SCRIPTS } from './scripts/registry';
import { advanceUntil, fullControl, must, ORACLE, put, startedGame } from './testing/harness';

const REBIRTH = 'Malakir Rebirth // Malakir Mire';
const AGADEEM = "Agadeem's Awakening // Agadeem, the Undercrypt";
const HALVAR = 'Halvar, God of Battle // Sword of the Realms';

const DECK = [REBIRTH, AGADEEM, HALVAR, 'Swamp', 'Plains', 'Forest'];

/**
 * `name` in p1's hand, and its instance id.
 *
 * ⚠️ Through the harness's `put`, which goes via the real `ManualMoveCard` — so
 * the board every check below asserts on is one the engine could genuinely
 * produce, and the whole scenario replays.
 */
function inHand(game: Game, name: string): string {
  return put(game, 'p1', name, 'hand');
}

function game(): Game {
  return startedGame({ players: 2, decks: [DECK, ['Forest']] });
}

describe('a modal DFC is played as the face you chose (CR 712)', () => {
  test('the fixtures are real modal DFCs, both faces', () => {
    const card = ORACLE.byName(REBIRTH);
    expect(card?.layout).toBe('modal_dfc');
    expect(card?.faces[0]?.name).toBe('Malakir Rebirth');
    expect(card?.faces[1]?.name).toBe('Malakir Mire');
    // ⚠️ The BACK is the land. Face 0 is an instant, so `playLand` reading face
    // 0 rejected it as `notALand` — the failure this file exists for.
    expect(card?.faces[0]?.isLand).toBe(false);
    expect(card?.faces[1]?.isLand).toBe(true);
  });

  test('BOTH faces are offered as legal actions, and they were before D155 too', () => {
    const g = game();
    const id = inHand(g, REBIRTH);
    const mine = legalActions(g.state, ORACLE, NO_SCRIPTS, 'p1').filter(
      (a) => 'card' in a && a.card === id,
    );
    // One cast (the instant) and one land drop (the back face) — the offer was
    // never the broken half, which is what made this so quiet.
    expect(mine.map((a) => a.t).sort()).toEqual(['CastSpell', 'PlayLand']);
    // ⚠️ And the land action names FACE 1. `useEngineTable` took the first match
    // and dropped this number on the floor; `faceOptionsFor` is what reads it.
    expect(mine.find((a) => a.t === 'PlayLand' && a.faceIndex === 1)).toBeDefined();
  });

  test('playing the LAND half puts the land on the battlefield', () => {
    const g = game();
    const id = inHand(g, REBIRTH);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: id, faceIndex: 1 }));
    const card = g.state.cards[id];
    expect(card?.zone.kind).toBe('battlefield');
    // ⚠️ THE PERMANENT REMEMBERS WHICH FACE. `clearBattlefieldFields` resets
    // `faceIndex` on every zone change, so without the face riding on the MOVE
    // this would be 0 and the battlefield would hold an instant.
    expect(card?.faceIndex).toBe(1);
  });

  /**
   * ⚠️ **D134's RULE, ON A BACK FACE, FOR THE FIRST TIME.** `Malakir Mire` reads
   * "This land enters tapped." The funnel reads the state BEFORE its own event,
   * so the face has to be on the move — an earlier `FaceIndexSet` in the same
   * batch would not be visible to it, and a later one is too late to matter.
   */
  test('and the back face’s ENTERS TAPPED is read (D134)', () => {
    const g = game();
    const id = inHand(g, REBIRTH);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: id, faceIndex: 1 }));
    expect(g.state.cards[id]?.tapped).toBe(true);
  });

  /**
   * ⚠️ **AND D136's PROMPT, WHICH ITS OWN REPORTABLE SAID NO BACK FACE COULD
   * REACH.** `Agadeem, the Undercrypt` is "As this land enters, you may pay 3
   * life. If you don't, it enters tapped." D136 measured 16 printings of that
   * wording and named every one of them unreachable.
   */
  test('and the back face’s pay-to-enter prompt is raised (D136)', () => {
    const g = game();
    const id = inHand(g, AGADEEM);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: id, faceIndex: 1 }));
    const awaiting = g.state.priority.awaiting;
    expect(awaiting?.kind).toBe('entersChoice');
    if (awaiting?.kind !== 'entersChoice') throw new Error('unreachable');
    expect(awaiting.player).toBe('p1');
    expect(awaiting.life).toBe(3);
  });

  test('the FRONT face still plays as itself, and is not a land', () => {
    const g = game();
    const id = inHand(g, REBIRTH);
    // Face 0 is an instant: playing it as a land must be refused by NAME.
    const r = g.submit({ t: 'PlayLand', player: 'p1', card: id, faceIndex: 0 });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.reason).toBe('notALand');
  });

  /**
   * ⚠️ THE HOST DECIDES LEGALITY (D139). A face index the card does not have —
   * or one it has but cannot be played independently — is refused here rather
   * than trusted from whatever sent it.
   */
  test('a face the card does not have is refused', () => {
    const g = game();
    const id = inHand(g, REBIRTH);
    expect(g.submit({ t: 'PlayLand', player: 'p1', card: id, faceIndex: 7 }).ok).toBe(false);
    expect(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 7 }).ok).toBe(false);
  });

  /**
   * ⚠️ THE SPELL HALF GOES THROUGH THE STACK, which is the harder path: the face
   * has to survive hand → stack AND stack → battlefield. `resolveTop` decides
   * whether a spell is a permanent by reading the card's face, so without the
   * face on the first move `Sword of the Realms` resolves into the GRAVEYARD.
   */
  test('a back face that is a permanent SPELL resolves onto the battlefield as itself', () => {
    const sword = ORACLE.byName(HALVAR)?.faces[1];
    expect(sword?.name).toBe('Sword of the Realms');
    expect(sword?.isPermanent).toBe(true);
    // The face's OWN cost is charged — {1}{W}, not Halvar's {2}{W}{W}, which is
    // `prepareCast` already building the problem from the face it was given.
    expect(sword?.manaCost?.generic).toBe(1);

    const g = startedGame({ decks: [['Plains', 'Plains', HALVAR], ['Grizzly Bears']] });
    fullControl(g, 'p1');
    put(g, 'p1', 'Plains');
    put(g, 'p1', 'Plains');
    const id = inHand(g, HALVAR);

    must(g.submit({ t: 'CastSpell', player: 'p1', card: id, faceIndex: 1 }));
    // On the stack AS the back face — which is what `resolveTop` reads to decide
    // the spell is a permanent at all.
    expect(g.state.cards[id]?.zone.kind).toBe('stack');
    expect(g.state.cards[id]?.faceIndex).toBe(1);

    advanceUntil(g, (s) => s.stack.length === 0, 400);
    // ⚠️ THE BATTLEFIELD, NOT THE GRAVEYARD. Without the face on the FIRST move
    // `resolveTop` reads face 0 — a legendary CREATURE — and this still lands on
    // the battlefield, which is why the assertion has to be the face and not
    // merely the zone.
    expect(g.state.cards[id]?.zone.kind).toBe('battlefield');
    expect(g.state.cards[id]?.faceIndex).toBe(1);
    expect(stateHash(replay(g.log, g.seed))).toBe(g.hash());
  });

  /**
   * ⚠️ THE LOG REPLAYS TO THE SAME STATE. `faceIndex` is on `CardMove`,
   * `StackObject` and `PendingCast`, and all three are part of `GameState` and
   * so of the hash — a face that were applied live and not on replay would be a
   * silent divergence on exactly these cards.
   */
  test('and the log replays to the same state', () => {
    const g = game();
    const id = inHand(g, REBIRTH);
    must(g.submit({ t: 'PlayLand', player: 'p1', card: id, faceIndex: 1 }));
    const replayed = replay(g.log, g.seed);
    expect(stateHash(replayed)).toBe(g.hash());
    expect(replayed.cards[id]?.faceIndex).toBe(1);
  });
});
