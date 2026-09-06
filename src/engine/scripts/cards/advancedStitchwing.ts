// `Advanced Stitchwing` - an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ADVANCED_STITCHWING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ADVANCED_STITCHWING, "Flying\n{2}{U}, Discard two cards: Return this card from your graveyard to the battlefield tapped.");
const LINES = PRINTED.split('\n');

export const ADVANCED_STITCHWING_SCRIPT: CardScript = {
  oracleId: ADVANCED_STITCHWING.oracleId,
  name: ADVANCED_STITCHWING.name,
  activated: [
    {
      ref: `${ADVANCED_STITCHWING.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }, { t: 'PermanentsTapped', cards: [self] }];
      },
    },
  ],
};
