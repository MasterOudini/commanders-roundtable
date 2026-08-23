// `Whalebone Glider` — "{2}, {T}: Target creature with power 3 or less gains
// flying until end of turn."
//
// ⚠️ The power qualifier is ENFORCED by the targeting layer against DERIVED
// power (D139's numeric restriction; Aysen Bureaucrats and Ephara's Warden
// are shipped), so the def owes only the grant. Worth stating beside D265's
// finding: a NUMERIC qualifier is enforced while a KEYWORD qualifier is
// silently dropped — the aim layer is not uniformly weak on qualifiers, it is
// weak on one kind. D268.

import { WHALEBONE_GLIDER } from '../../../data/fixtures/engineCards';
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
  WHALEBONE_GLIDER,
  '{2}, {T}: Target creature with power 3 or less gains flying until end of turn.',
);

export const WHALEBONE_GLIDER_SCRIPT: CardScript = {
  oracleId: WHALEBONE_GLIDER.oracleId,
  name: WHALEBONE_GLIDER.name,
  activated: [
    {
      ref: `${WHALEBONE_GLIDER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['flying'],
          },
        ];
      },
    },
  ],
};
