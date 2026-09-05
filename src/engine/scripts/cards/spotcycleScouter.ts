// `Spotcycle Scouter` - a etb trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPOTCYCLE_SCOUTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPOTCYCLE_SCOUTER, "When this Vehicle enters, scry 2. (Look at the top two cards of your library, then put any number of them on the bottom and the rest on top in any order.)\nCrew 1 (Tap any number of creatures you control with total power 1 or more: This Vehicle becomes an artifact creature until end of turn.)");
const LINES = PRINTED.split('\n');

export const SPOTCYCLE_SCOUTER_SCRIPT: CardScript = {
  oracleId: SPOTCYCLE_SCOUTER.oracleId,
  name: SPOTCYCLE_SCOUTER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Spotcycle Scouter - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Spotcycle Scouter - scry 2" } },
        ];
      },
    },
  ],
};
