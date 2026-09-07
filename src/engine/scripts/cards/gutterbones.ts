// `Gutterbones` - an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GUTTERBONES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GUTTERBONES, "This creature enters tapped.\n{1}{B}: Return this card from your graveyard to your hand. Activate only during your turn and only if an opponent lost life this turn.");
const LINES = PRINTED.split('\n');

export const GUTTERBONES_SCRIPT: CardScript = {
  oracleId: GUTTERBONES.oracleId,
  name: GUTTERBONES.name,
  activated: [
    {
      ref: `${GUTTERBONES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
