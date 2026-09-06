// `Dread Wanderer` - an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DREAD_WANDERER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DREAD_WANDERER, "This creature enters tapped.\n{2}{B}: Return this card from your graveyard to the battlefield. Activate only as a sorcery and only if you have one or fewer cards in hand.");
const LINES = PRINTED.split('\n');

export const DREAD_WANDERER_SCRIPT: CardScript = {
  oracleId: DREAD_WANDERER.oracleId,
  name: DREAD_WANDERER.name,
  activated: [
    {
      ref: `${DREAD_WANDERER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }];
      },
    },
  ],
};
