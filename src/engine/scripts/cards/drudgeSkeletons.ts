// `Drudge Skeletons` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DRUDGE_SKELETONS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DRUDGE_SKELETONS, "{B}: Regenerate this creature. (The next time this creature would be destroyed this turn, instead tap it, remove it from combat, and heal all damage on it.)");

export const DRUDGE_SKELETONS_SCRIPT: CardScript = {
  oracleId: DRUDGE_SKELETONS.oracleId,
  name: DRUDGE_SKELETONS.name,
  activated: [
    {
      ref: `${DRUDGE_SKELETONS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
