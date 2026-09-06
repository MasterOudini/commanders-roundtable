// `Throne of the High City` - an activation monarch
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRONE_OF_THE_HIGH_CITY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { n, narrated, vb, who } from '../../narrate';

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

const PRINTED = printed(THRONE_OF_THE_HIGH_CITY, "{T}: Add {C}.\n{4}, {T}, Sacrifice this land: You become the monarch.");
const LINES = PRINTED.split('\n');

export const THRONE_OF_THE_HIGH_CITY_SCRIPT: CardScript = {
  oracleId: THRONE_OF_THE_HIGH_CITY.oracleId,
  name: THRONE_OF_THE_HIGH_CITY.name,
  activated: [
    {
      ref: `${THRONE_OF_THE_HIGH_CITY.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return [{ t: 'MonarchChanged', player: obj.controller }, narrated(n`${who(ctx.state, obj.controller)} ${vb(obj.controller, 'becomes', 'become')} the monarch.`, obj.controller)];
      },
    },
  ],
};
