// `Balloon Peddler` — blue mana, the tap and a discarded card of my choice
// (D286) give a creature flying until cleanup.

import { BALLOON_PEDDLER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BALLOON_PEDDLER, '{U}, {T}, Discard a card: Target creature gains flying until end of turn.');

export const BALLOON_PEDDLER_SCRIPT: CardScript = {
  oracleId: BALLOON_PEDDLER.oracleId,
  name: BALLOON_PEDDLER.name,
  activated: [
    {
      ref: `${BALLOON_PEDDLER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] }];
      },
    },
  ],
};
