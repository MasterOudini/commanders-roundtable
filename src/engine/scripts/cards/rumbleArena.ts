// `Rumble Arena` - a etb trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUMBLE_ARENA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(RUMBLE_ARENA, "Vigilance\nWhen this land enters, scry 1. (Look at the top card of your library. You may put it on the bottom.)\n{T}: Add {C}.\n{1}, {T}: Add one mana of any color.");
const LINES = PRINTED.split('\n');

export const RUMBLE_ARENA_SCRIPT: CardScript = {
  oracleId: RUMBLE_ARENA.oracleId,
  name: RUMBLE_ARENA.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Rumble Arena - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Rumble Arena - scry 1" } },
        ];
      },
    },
  ],
};
