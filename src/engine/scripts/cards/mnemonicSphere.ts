// `Mnemonic Sphere` - an activation drawN, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MNEMONIC_SPHERE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MNEMONIC_SPHERE, "{1}{U}, Sacrifice this artifact: Draw two cards.\nChannel — {U}, Discard this card: Draw a card.");
const LINES = PRINTED.split('\n');

export const MNEMONIC_SPHERE_SCRIPT: CardScript = {
  oracleId: MNEMONIC_SPHERE.oracleId,
  name: MNEMONIC_SPHERE.name,
  activated: [
    {
      ref: `${MNEMONIC_SPHERE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 2);
      },
    },
    {
      ref: `${MNEMONIC_SPHERE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
