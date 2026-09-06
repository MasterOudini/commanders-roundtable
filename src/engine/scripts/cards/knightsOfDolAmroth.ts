// `Knights of Dol Amroth` - a secondCard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHTS_OF_DOL_AMROTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHTS_OF_DOL_AMROTH, "Whenever you draw your second card each turn, put a +1/+1 counter on this creature.");

export const KNIGHTS_OF_DOL_AMROTH_SCRIPT: CardScript = {
  oracleId: KNIGHTS_OF_DOL_AMROTH.oracleId,
  name: KNIGHTS_OF_DOL_AMROTH.name,
  triggers: [
    {
      abilityId: 'secondCard-0',
      text: PRINTED,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Knights of Dol Amroth - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
