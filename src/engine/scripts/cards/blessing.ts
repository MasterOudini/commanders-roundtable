// `Blessing` - an activation attachedTemp
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLESSING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLESSING, "Enchant creature\n{W}: Enchanted creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const BLESSING_SCRIPT: CardScript = {
  oracleId: BLESSING.oracleId,
  name: BLESSING.name,
  activated: [
    {
      ref: `${BLESSING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: host, power: 1, toughness: 1 }];
      },
    },
  ],
};
