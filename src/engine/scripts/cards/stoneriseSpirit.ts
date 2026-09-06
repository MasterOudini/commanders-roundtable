// `Stonerise Spirit` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STONERISE_SPIRIT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STONERISE_SPIRIT, "Flying\n{4}, Exile a card from your graveyard: Target creature gains flying until end of turn.");
const LINES = PRINTED.split('\n');

export const STONERISE_SPIRIT_SCRIPT: CardScript = {
  oracleId: STONERISE_SPIRIT.oracleId,
  name: STONERISE_SPIRIT.name,
  activated: [
    {
      ref: `${STONERISE_SPIRIT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
};
