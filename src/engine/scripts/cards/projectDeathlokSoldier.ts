// `Project Deathlok Soldier` - an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROJECT_DEATHLOK_SOLDIER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROJECT_DEATHLOK_SOLDIER, "{2}{B}: Return this card from your graveyard to your hand.");

export const PROJECT_DEATHLOK_SOLDIER_SCRIPT: CardScript = {
  oracleId: PROJECT_DEATHLOK_SOLDIER.oracleId,
  name: PROJECT_DEATHLOK_SOLDIER.name,
  activated: [
    {
      ref: `${PROJECT_DEATHLOK_SOLDIER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
