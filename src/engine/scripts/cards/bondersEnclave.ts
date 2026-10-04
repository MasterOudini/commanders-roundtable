// `Bonders' Enclave` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BONDERS_ENCLAVE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(BONDERS_ENCLAVE, "{T}: Add {C}.\n{3}, {T}: Draw a card. Activate only if you control a creature with power 4 or greater.");
const LINES = PRINTED.split('\n');

export const BONDERS_ENCLAVE_SCRIPT: CardScript = {
  oracleId: BONDERS_ENCLAVE.oracleId,
  name: BONDERS_ENCLAVE.name,
  activated: [
    {
      ref: `${BONDERS_ENCLAVE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
