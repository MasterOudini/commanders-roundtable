// `Oboro, Palace in the Clouds` - an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OBORO_PALACE_IN_THE_CLOUDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OBORO_PALACE_IN_THE_CLOUDS, "{T}: Add {U}.\n{1}: Return Oboro to its owner's hand.");
const LINES = PRINTED.split('\n');

export const OBORO_PALACE_IN_THE_CLOUDS_SCRIPT: CardScript = {
  oracleId: OBORO_PALACE_IN_THE_CLOUDS.oracleId,
  name: OBORO_PALACE_IN_THE_CLOUDS.name,
  activated: [
    {
      ref: `${OBORO_PALACE_IN_THE_CLOUDS.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
