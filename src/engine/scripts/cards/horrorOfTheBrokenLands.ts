// `Horror of the Broken Lands` - a youDiscard trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORROR_OF_THE_BROKEN_LANDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORROR_OF_THE_BROKEN_LANDS, "Whenever you cycle or discard another card, this creature gets +2/+1 until end of turn.\nCycling {B} ({B}, Discard this card: Draw a card.)");
const LINES = PRINTED.split('\n');

export const HORROR_OF_THE_BROKEN_LANDS_SCRIPT: CardScript = {
  oracleId: HORROR_OF_THE_BROKEN_LANDS.oracleId,
  name: HORROR_OF_THE_BROKEN_LANDS.name,
  triggers: [
    {
      abilityId: 'youDiscard-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => (m.reason === 'cycling' || m.reason === 'discard') && m.from.kind === 'hand' && m.card !== self && m.from.player === ctx.query.controllerOf(self),
        ),
      label: () => "Horror of the Broken Lands - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 1 }];
      },
    },
  ],
};
