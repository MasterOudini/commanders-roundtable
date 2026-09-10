// `Prickly Marmoset` - a youCycle trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PRICKLY_MARMOSET } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PRICKLY_MARMOSET, "First strike\nWhenever you cycle a card, this creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const PRICKLY_MARMOSET_SCRIPT: CardScript = {
  oracleId: PRICKLY_MARMOSET.oracleId,
  name: PRICKLY_MARMOSET.name,
  triggers: [
    {
      abilityId: 'youCycle-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'cycling' && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Prickly Marmoset - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
