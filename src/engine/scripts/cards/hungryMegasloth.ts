// `Hungry Megasloth` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HUNGRY_MEGASLOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HUNGRY_MEGASLOTH, "Reach (This creature can block creatures with flying.)\n{2}, {T}: Put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const HUNGRY_MEGASLOTH_SCRIPT: CardScript = {
  oracleId: HUNGRY_MEGASLOTH.oracleId,
  name: HUNGRY_MEGASLOTH.name,
  activated: [
    {
      ref: `${HUNGRY_MEGASLOTH.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
