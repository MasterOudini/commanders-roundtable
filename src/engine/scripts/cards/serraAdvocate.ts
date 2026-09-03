// `Serra Advocate` — pump on an ATTACKING creature; the combat role is the parser's and
// the validator's (D291). Generated from one table row (D292).

import { SERRA_ADVOCATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SERRA_ADVOCATE, "Flying\n{T}: Target attacking or blocking creature gets +2/+2 until end of turn.");
const TEXT = PRINTED.split('\n')[1] as string;

export const SERRA_ADVOCATE_SCRIPT: CardScript = {
  oracleId: SERRA_ADVOCATE.oracleId,
  name: SERRA_ADVOCATE.name,
  activated: [
    {
      ref: `${SERRA_ADVOCATE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 }];
      },
    },
  ],
};
