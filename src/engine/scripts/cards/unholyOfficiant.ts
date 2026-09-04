// `Unholy Officiant` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { UNHOLY_OFFICIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(UNHOLY_OFFICIANT, "Vigilance\n{4}{W}: Put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const UNHOLY_OFFICIANT_SCRIPT: CardScript = {
  oracleId: UNHOLY_OFFICIANT.oracleId,
  name: UNHOLY_OFFICIANT.name,
  activated: [
    {
      ref: `${UNHOLY_OFFICIANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
