// `Hobgoblin, Mantled Marauder` - a youDiscard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOBGOBLIN_MANTLED_MARAUDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOBGOBLIN_MANTLED_MARAUDER, "Flying, haste\nWhenever you discard a card, Hobgoblin gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const HOBGOBLIN_MANTLED_MARAUDER_SCRIPT: CardScript = {
  oracleId: HOBGOBLIN_MANTLED_MARAUDER.oracleId,
  name: HOBGOBLIN_MANTLED_MARAUDER.name,
  triggers: [
    {
      abilityId: 'youDiscard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'discard' && m.from.kind === 'hand' && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Hobgoblin, Mantled Marauder - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
