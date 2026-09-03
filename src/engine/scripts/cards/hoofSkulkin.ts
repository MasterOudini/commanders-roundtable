// `Hoof Skulkin` - pump on "Target green creature gets +1/+1 until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { HOOF_SKULKIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOOF_SKULKIN, "{3}: Target green creature gets +1/+1 until end of turn.");
const TEXT = PRINTED;

export const HOOF_SKULKIN_SCRIPT: CardScript = {
  oracleId: HOOF_SKULKIN.oracleId,
  name: HOOF_SKULKIN.name,
  activated: [
    {
      ref: `${HOOF_SKULKIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
