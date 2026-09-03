// `Quicksand` — pump on an ATTACKING creature; the combat role is the parser's and
// the validator's (D291), the keyword D289's. Generated from one table row (D292).

import { QUICKSAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(QUICKSAND, "{T}: Add {C}.\n{T}, Sacrifice this land: Target attacking creature without flying gets -1/-2 until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const QUICKSAND_SCRIPT: CardScript = {
  oracleId: QUICKSAND.oracleId,
  name: QUICKSAND.name,
  activated: [
    {
      ref: `${QUICKSAND.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -2 }];
      },
    },
  ],
};
