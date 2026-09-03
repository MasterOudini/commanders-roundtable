// `Kelsinko Ranger` - pump on "Target green creature gains first strike until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { KELSINKO_RANGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KELSINKO_RANGER, "{1}{W}: Target green creature gains first strike until end of turn.");
const TEXT = PRINTED;

export const KELSINKO_RANGER_SCRIPT: CardScript = {
  oracleId: KELSINKO_RANGER.oracleId,
  name: KELSINKO_RANGER.name,
  activated: [
    {
      ref: `${KELSINKO_RANGER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
