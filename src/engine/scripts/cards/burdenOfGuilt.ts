// `Burden of Guilt` - an activation tapAttached
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURDEN_OF_GUILT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURDEN_OF_GUILT, "Enchant creature\n{1}: Tap enchanted creature.");
const LINES = PRINTED.split('\n');

export const BURDEN_OF_GUILT_SCRIPT: CardScript = {
  oracleId: BURDEN_OF_GUILT.oracleId,
  name: BURDEN_OF_GUILT.name,
  activated: [
    {
      ref: `${BURDEN_OF_GUILT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const host = ctx.state.cards[self]?.attachedTo ?? null;
        if (host === null) return [];
        const card = ctx.state.cards[host];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [host] }];
      },
    },
  ],
};
