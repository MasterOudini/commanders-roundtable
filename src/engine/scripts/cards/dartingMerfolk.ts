// `Darting Merfolk` - an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARTING_MERFOLK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARTING_MERFOLK, "{U}: Return this creature to its owner's hand.");

export const DARTING_MERFOLK_SCRIPT: CardScript = {
  oracleId: DARTING_MERFOLK.oracleId,
  name: DARTING_MERFOLK.name,
  activated: [
    {
      ref: `${DARTING_MERFOLK.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
