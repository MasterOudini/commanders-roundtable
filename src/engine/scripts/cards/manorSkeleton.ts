// `Manor Skeleton` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANOR_SKELETON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANOR_SKELETON, "Haste\n{1}{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const MANOR_SKELETON_SCRIPT: CardScript = {
  oracleId: MANOR_SKELETON.oracleId,
  name: MANOR_SKELETON.name,
  activated: [
    {
      ref: `${MANOR_SKELETON.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
