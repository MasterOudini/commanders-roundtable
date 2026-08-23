// `Viscera Seer` — the sacrifice chooser (D168) paying a SCRY ask (D195),
// with NO mana in the cost at all: the creature IS the price (Aura Fracture's
// shape, D169). D266.

import { VISCERA_SEER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  VISCERA_SEER,
  'Sacrifice a creature: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);

export const VISCERA_SEER_SCRIPT: CardScript = {
  oracleId: VISCERA_SEER.oracleId,
  name: VISCERA_SEER.name,
  activated: [
    {
      ref: `${VISCERA_SEER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
