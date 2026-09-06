// `Faerie Vandal` - a secondCard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_VANDAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_VANDAL, "Flash (You may cast this spell any time you could cast an instant.)\nFlying\nWhenever you draw your second card each turn, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

export const FAERIE_VANDAL_SCRIPT: CardScript = {
  oracleId: FAERIE_VANDAL.oracleId,
  name: FAERIE_VANDAL.name,
  triggers: [
    {
      abilityId: 'secondCard-2',
      text: LINES[2] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Faerie Vandal - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
