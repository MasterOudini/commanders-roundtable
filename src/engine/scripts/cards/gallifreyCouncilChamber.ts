// `Gallifrey Council Chamber` - a etb trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GALLIFREY_COUNCIL_CHAMBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GALLIFREY_COUNCIL_CHAMBER, "When Gallifrey Council Chamber enters, surveil 1. (Look at the top card of your library. You may put that card into your graveyard.)\n{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a Time Lord or Alien spell or activate an ability of a Time Lord or Alien.");
const LINES = PRINTED.split('\n');

export const GALLIFREY_COUNCIL_CHAMBER_SCRIPT: CardScript = {
  oracleId: GALLIFREY_COUNCIL_CHAMBER.oracleId,
  name: GALLIFREY_COUNCIL_CHAMBER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Gallifrey Council Chamber - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Gallifrey Council Chamber - surveil 1" } },
        ];
      },
    },
  ],
};
