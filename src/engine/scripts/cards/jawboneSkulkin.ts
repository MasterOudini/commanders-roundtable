// `Jawbone Skulkin` - pump on "Target red creature gains haste until end of turn": the adjective is the parser's and the
// validator's (D294). Generated from one table row (D295).

import { JAWBONE_SKULKIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JAWBONE_SKULKIN, "{2}: Target red creature gains haste until end of turn.");
const TEXT = PRINTED;

export const JAWBONE_SKULKIN_SCRIPT: CardScript = {
  oracleId: JAWBONE_SKULKIN.oracleId,
  name: JAWBONE_SKULKIN.name,
  activated: [
    {
      ref: `${JAWBONE_SKULKIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["haste"] }];
      },
    },
  ],
};
