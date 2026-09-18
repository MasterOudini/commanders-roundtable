// `Morbid Opportunist` - a anyOtherCreatureDies trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORBID_OPPORTUNIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORBID_OPPORTUNIST, "Whenever one or more other creatures die, draw a card. This ability triggers only once each turn.");

export const MORBID_OPPORTUNIST_SCRIPT: CardScript = {
  oracleId: MORBID_OPPORTUNIST.oracleId,
  name: MORBID_OPPORTUNIST.name,
  triggers: [
    {
      abilityId: 'anyOtherCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Morbid Opportunist - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
