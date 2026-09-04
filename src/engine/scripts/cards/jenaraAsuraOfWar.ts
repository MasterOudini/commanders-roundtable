// `Jenara, Asura of War` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JENARA_ASURA_OF_WAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JENARA_ASURA_OF_WAR, "Flying\n{1}{W}: Put a +1/+1 counter on Jenara.");
const LINES = PRINTED.split('\n');

export const JENARA_ASURA_OF_WAR_SCRIPT: CardScript = {
  oracleId: JENARA_ASURA_OF_WAR.oracleId,
  name: JENARA_ASURA_OF_WAR.name,
  activated: [
    {
      ref: `${JENARA_ASURA_OF_WAR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
