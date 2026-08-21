// `Sylvan Safekeeper` — the mana-free LAND chooser granting shroud, which
// rides D194's carrier and ends at cleanup. D256.

import { SYLVAN_SAFEKEEPER } from '../../../data/fixtures/engineCards';
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
  SYLVAN_SAFEKEEPER,
  'Sacrifice a land: Target creature you control gains shroud until end of turn. ' +
    "(It can't be the target of spells or abilities.)",
);

export const SYLVAN_SAFEKEEPER_SCRIPT: CardScript = {
  oracleId: SYLVAN_SAFEKEEPER.oracleId,
  name: SYLVAN_SAFEKEEPER.name,
  activated: [
    {
      ref: `${SYLVAN_SAFEKEEPER.oracleId}#a0`,
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
            keywords: ['shroud'],
          },
        ];
      },
    },
  ],
};
