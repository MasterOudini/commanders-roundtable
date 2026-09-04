// `Restless Apparition` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RESTLESS_APPARITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RESTLESS_APPARITION, "{W/B}{W/B}{W/B}: This creature gets +3/+3 until end of turn.\nPersist (When this creature dies, if it had no -1/-1 counters on it, return it to the battlefield under its owner's control with a -1/-1 counter on it.)");
const LINES = PRINTED.split('\n');

export const RESTLESS_APPARITION_SCRIPT: CardScript = {
  oracleId: RESTLESS_APPARITION.oracleId,
  name: RESTLESS_APPARITION.name,
  activated: [
    {
      ref: `${RESTLESS_APPARITION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 3, toughness: 3 }];
      },
    },
  ],
};
