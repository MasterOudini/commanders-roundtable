// `Vectis Agents` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VECTIS_AGENTS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VECTIS_AGENTS, "{U}{B}: This creature gets -2/-0 until end of turn and can't be blocked this turn.");

export const VECTIS_AGENTS_SCRIPT: CardScript = {
  oracleId: VECTIS_AGENTS.oracleId,
  name: VECTIS_AGENTS.name,
  activated: [
    {
      ref: `${VECTIS_AGENTS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: -2, toughness: 0, cantBeBlocked: true }];
      },
    },
  ],
};
