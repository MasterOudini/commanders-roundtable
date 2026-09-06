// `Lotleth Troll` - an activation selfCounter, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOTLETH_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOTLETH_TROLL, "Trample\nDiscard a creature card: Put a +1/+1 counter on this creature.\n{B}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const LOTLETH_TROLL_SCRIPT: CardScript = {
  oracleId: LOTLETH_TROLL.oracleId,
  name: LOTLETH_TROLL.name,
  activated: [
    {
      ref: `${LOTLETH_TROLL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      ref: `${LOTLETH_TROLL.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
