// `Ithilien Kingfisher` — "When this creature dies, draw a card." M6.4z,
// D182.

import { ITHILIEN_KINGFISHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ITHILIEN_KINGFISHER, 'Flying\nWhen this creature dies, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const ITHILIEN_KINGFISHER_SCRIPT: CardScript = {
  oracleId: ITHILIEN_KINGFISHER.oracleId,
  name: ITHILIEN_KINGFISHER.name,
  triggers: [
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Ithilien Kingfisher — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
