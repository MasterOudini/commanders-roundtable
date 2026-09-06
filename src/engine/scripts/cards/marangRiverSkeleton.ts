// `Marang River Skeleton` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARANG_RIVER_SKELETON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARANG_RIVER_SKELETON, "{B}: Regenerate this creature.\nMegamorph {3}{B} (You may cast this card face down as a 2/2 creature for {3}. Turn it face up any time for its megamorph cost and put a +1/+1 counter on it.)");
const LINES = PRINTED.split('\n');

export const MARANG_RIVER_SKELETON_SCRIPT: CardScript = {
  oracleId: MARANG_RIVER_SKELETON.oracleId,
  name: MARANG_RIVER_SKELETON.name,
  activated: [
    {
      ref: `${MARANG_RIVER_SKELETON.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
