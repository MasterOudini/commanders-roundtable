// `Seismic Monstrosaur` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEISMIC_MONSTROSAUR } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(SEISMIC_MONSTROSAUR, "Trample\n{2}{R}, Sacrifice a land: Draw a card.\nMountaincycling {2} ({2}, Discard this card: Search your library for a Mountain card, reveal it, put it into your hand, then shuffle.)");
const LINES = PRINTED.split('\n');

export const SEISMIC_MONSTROSAUR_SCRIPT: CardScript = {
  oracleId: SEISMIC_MONSTROSAUR.oracleId,
  name: SEISMIC_MONSTROSAUR.name,
  activated: [
    {
      ref: `${SEISMIC_MONSTROSAUR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
