// `Aquus Steed` — "{2}{U}, {T}: Target creature gets -2/-0 until end of turn."
// M6.4d, D161.

import { AQUUS_STEED } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(AQUUS_STEED, '{2}{U}, {T}: Target creature gets -2/-0 until end of turn.');

export const AQUUS_STEED_SCRIPT: CardScript = {
  oracleId: AQUUS_STEED.oracleId,
  name: AQUUS_STEED.name,
  activated: [
    {
      ref: `${AQUUS_STEED.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: 0 }];
      },
    },
  ],
};
