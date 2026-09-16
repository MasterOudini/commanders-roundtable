// `Skystreak Engineer` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYSTREAK_ENGINEER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYSTREAK_ENGINEER, "Flying\nExhaust — {4}{U}: Put two +1/+1 counters on this creature. (Activate each exhaust ability only once.)");
const LINES = PRINTED.split('\n');

export const SKYSTREAK_ENGINEER_SCRIPT: CardScript = {
  oracleId: SKYSTREAK_ENGINEER.oracleId,
  name: SKYSTREAK_ENGINEER.name,
  activated: [
    {
      ref: `${SKYSTREAK_ENGINEER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
};
