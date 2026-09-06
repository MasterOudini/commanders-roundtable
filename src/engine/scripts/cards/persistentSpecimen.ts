// `Persistent Specimen` - an activation returnSelfFromGraveyard
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PERSISTENT_SPECIMEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PERSISTENT_SPECIMEN, "{2}{B}: Return this card from your graveyard to the battlefield tapped.");

export const PERSISTENT_SPECIMEN_SCRIPT: CardScript = {
  oracleId: PERSISTENT_SPECIMEN.oracleId,
  name: PERSISTENT_SPECIMEN.name,
  activated: [
    {
      ref: `${PERSISTENT_SPECIMEN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'battlefield', player: obj.controller } }] }, { t: 'PermanentsTapped', cards: [self] }];
      },
    },
  ],
};
