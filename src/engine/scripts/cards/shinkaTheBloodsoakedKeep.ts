// `Shinka, the Bloodsoaked Keep` - pump on "Target legendary creature gains first strike until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { SHINKA_THE_BLOODSOAKED_KEEP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHINKA_THE_BLOODSOAKED_KEEP, "{T}: Add {R}.\n{R}, {T}: Target legendary creature gains first strike until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const SHINKA_THE_BLOODSOAKED_KEEP_SCRIPT: CardScript = {
  oracleId: SHINKA_THE_BLOODSOAKED_KEEP.oracleId,
  name: SHINKA_THE_BLOODSOAKED_KEEP.name,
  activated: [
    {
      ref: `${SHINKA_THE_BLOODSOAKED_KEEP.oracleId}#a1`,
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
