import { describe, expect, test } from 'vitest';
import { canTapOnly, manaOptionsFor } from './manaOptions';
import { emptyView, zoneId } from '../../view/types';
import type { CardView, PlayerView } from '../../view/types';
import type { LegalAction } from '../../engine/legal';

// ⚠️ Pure, so it is tested here rather than only through a running app — the
// same reason `packRow` and `coalesce` have their own suites. What the panel
// DRAWS is the animation battery's job; what it is handed is this one's.

function tap(
  card: string,
  abilityIndex: number,
  outputs: string[],
  conditional = false,
): LegalAction {
  return { t: 'TapForMana', card, abilityIndex, outputs, conditional, label: card };
}

const OTHER: LegalAction = { t: 'PassPriority' };

describe('manaOptionsFor', () => {
  test('a basic land offers exactly one thing', () => {
    const options = manaOptionsFor([tap('forest', 0, ['{G}']), OTHER], 'forest');
    expect(options).toHaveLength(1);
    expect(options[0]?.cost).toBe('{G}');
  });

  /**
   * ⚠️ THE CASE THE WHOLE FEATURE EXISTS FOR. A dual land is two abilities of
   * one output each, so anything reading a single action's output count sees
   * "1" twice and concludes there is nothing to choose — which is exactly what
   * the click path did, tapping Tundra for white every time.
   */
  test('a dual land is TWO abilities and still two choices', () => {
    const options = manaOptionsFor([tap('tundra', 0, ['{W}']), tap('tundra', 1, ['{U}'])], 'tundra');
    expect(options.map((o) => o.cost)).toEqual(['{W}', '{U}']);
    expect(options.map((o) => o.abilityIndex)).toEqual([0, 1]);
    expect(options.every((o) => o.outputChoice === 0)).toBe(true);
  });

  test('an any-colour land is ONE ability whose outputs are the choices', () => {
    const options = manaOptionsFor([tap('tower', 0, ['{U}', '{B}', '{R}'])], 'tower');
    expect(options.map((o) => o.outputChoice)).toEqual([0, 1, 2]);
    expect(options.every((o) => o.abilityIndex === 0)).toBe(true);
  });

  test('an output of two mana is one choice, not two', () => {
    const options = manaOptionsFor([tap('ring', 0, ['{C}{C}'])], 'ring');
    expect(options).toHaveLength(1);
    expect(options[0]?.cost).toBe('{C}{C}');
  });

  test('only this card, however many sources are on the board', () => {
    const options = manaOptionsFor(
      [tap('forest', 0, ['{G}']), tap('island', 0, ['{U}']), tap('tundra', 0, ['{W}'])],
      'island',
    );
    expect(options.map((o) => o.cost)).toEqual(['{U}']);
  });

  /**
   * ⚠️ Cavern of Souls: one unconditional `{C}` and five restricted colours.
   * Hiding the restricted half would leave every colour the card exists for
   * unreachable — and it was, before this: the click path looked only for an
   * unconditional ability and took its first output.
   */
  test('restricted mana is offered too, and marked', () => {
    const options = manaOptionsFor(
      [tap('cavern', 0, ['{C}']), tap('cavern', 1, ['{W}', '{U}', '{B}', '{R}', '{G}'], true)],
      'cavern',
    );
    expect(options).toHaveLength(6);
    expect(options.filter((o) => o.conditional).map((o) => o.cost))
      .toEqual(['{W}', '{U}', '{B}', '{R}', '{G}']);
    expect(options[0]).toMatchObject({ cost: '{C}', conditional: false });
  });

  /**
   * ⚠️ Two buttons reading `{C}` above `{C}` and behaving differently is the one
   * shape this must never take.
   */
  test('two abilities that add the same thing are one choice', () => {
    const options = manaOptionsFor([tap('rock', 0, ['{C}']), tap('rock', 1, ['{C}'])], 'rock');
    expect(options).toHaveLength(1);
  });

  test('the unconditional one wins the slot, and keeps its place', () => {
    const options = manaOptionsFor(
      [tap('odd', 0, ['{G}'], true), tap('odd', 1, ['{U}']), tap('odd', 2, ['{G}'])],
      'odd',
    );
    expect(options.map((o) => o.cost)).toEqual(['{G}', '{U}']);
    expect(options[0]).toMatchObject({ abilityIndex: 2, conditional: false });
  });

  test('a card with no mana ability offers nothing', () => {
    expect(manaOptionsFor([tap('forest', 0, ['{G}'])], 'bear')).toEqual([]);
  });
});

// ── Turning a card for the sake of turning it ────────────────────────────────

function board(cards: { id: string; controller: string; tapped?: boolean; zone?: 'bf' | 'hand' }[]):
  PlayerView {
  const view = emptyView('me');
  for (const c of cards) {
    view.cards[c.id] = {
      instanceId: c.id, card: null, faceIndex: 0, faceDown: false,
      controller: c.controller, owner: c.controller, tapped: c.tapped ?? false,
      summoningSick: false, damage: 0, counters: {}, power: null, toughness: null,
      attachedTo: null, isCommander: false, isToken: false, attacking: null, blocking: [],
    } satisfies CardView;
    const zone = zoneId(c.zone ?? 'bf', c.controller);
    view.zones[zone] = [...(view.zones[zone] ?? []), c.id];
  }
  return view;
}

describe('canTapOnly', () => {
  test('my own untapped permanent may just be turned', () => {
    expect(canTapOnly(board([{ id: 'bear', controller: 'me' }]), 'bear', 'me')).toBe(true);
  });

  /** "Tap" on a tapped card is not a choice; untapping lives in the menu and on E. */
  test('an already-tapped permanent is not offered', () => {
    expect(canTapOnly(board([{ id: 'bear', controller: 'me', tapped: true }]), 'bear', 'me'))
      .toBe(false);
  });

  /**
   * ⚠️ A left click that turned someone else's permanent would make a misclick
   * look like a play. E and the card menu still reach them.
   */
  test("an opponent's permanent is not offered", () => {
    expect(canTapOnly(board([{ id: 'bear', controller: 'them' }]), 'bear', 'me')).toBe(false);
  });

  test('a card in hand is not offered — tapping is battlefield-only', () => {
    expect(canTapOnly(board([{ id: 'bolt', controller: 'me', zone: 'hand' }]), 'bolt', 'me'))
      .toBe(false);
  });

  test('a card that is not in the game at all is not offered', () => {
    expect(canTapOnly(board([]), 'ghost', 'me')).toBe(false);
  });
});
