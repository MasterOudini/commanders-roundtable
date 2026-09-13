// `Kuldotha Phoenix` - an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KULDOTHA_PHOENIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KULDOTHA_PHOENIX, "Flying, haste\nMetalcraft — {4}: Return this card from your graveyard to the battlefield. Activate only during your upkeep and only if you control three or more artifacts.");
const LINES = PRINTED.split('\n');

export const KULDOTHA_PHOENIX_SCRIPT: CardScript = {
  oracleId: KULDOTHA_PHOENIX.oracleId,
  name: KULDOTHA_PHOENIX.name,
  activated: [
    {
      ref: `${KULDOTHA_PHOENIX.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
};
