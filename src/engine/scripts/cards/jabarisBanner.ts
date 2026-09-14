// `Jabari's Banner` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JABARI_S_BANNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JABARI_S_BANNER, "{1}, {T}: Target creature gains flanking until end of turn. (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)");

export const JABARIS_BANNER_SCRIPT: CardScript = {
  oracleId: JABARI_S_BANNER.oracleId,
  name: JABARI_S_BANNER.name,
  activated: [
    {
      ref: `${JABARI_S_BANNER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["flanking"] }];
      },
    },
  ],
};
