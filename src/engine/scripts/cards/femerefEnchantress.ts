// `Femeref Enchantress` — "Whenever an enchantment is put into a graveyard
// from the battlefield, draw a card." ANY controller's enchantment — the
// dying card's type is asked of the BEFORE board (looksBack), where the
// enchantment still has a battlefield derivation to read. M6.4r, D174.

import { FEMEREF_ENCHANTRESS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const TEXT = printed(
  FEMEREF_ENCHANTRESS,
  'Whenever an enchantment is put into a graveyard from the battlefield, draw a card.',
);

export const FEMEREF_ENCHANTRESS_SCRIPT: CardScript = {
  oracleId: FEMEREF_ENCHANTRESS.oracleId,
  name: FEMEREF_ENCHANTRESS.name,
  triggers: [
    {
      abilityId: 'enchantment-dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.from.kind === 'battlefield' &&
            m.to.kind === 'graveyard' &&
            ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => 'Femeref Enchantress — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
