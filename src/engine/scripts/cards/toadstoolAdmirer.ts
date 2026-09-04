// `Toadstool Admirer` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOADSTOOL_ADMIRER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOADSTOOL_ADMIRER, "Ward {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\n{3}{G}: Put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const TOADSTOOL_ADMIRER_SCRIPT: CardScript = {
  oracleId: TOADSTOOL_ADMIRER.oracleId,
  name: TOADSTOOL_ADMIRER.name,
  activated: [
    {
      ref: `${TOADSTOOL_ADMIRER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
