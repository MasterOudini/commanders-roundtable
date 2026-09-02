// `Youthful Scholar` — "When this creature dies, draw two cards." A dies
// watcher (looksBack: the Scholar is already in the graveyard when its death
// is seen), the draws through the one draw rule. D271.

import { YOUTHFUL_SCHOLAR } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(YOUTHFUL_SCHOLAR, 'When this creature dies, draw two cards.');

export const YOUTHFUL_SCHOLAR_SCRIPT: CardScript = {
  oracleId: YOUTHFUL_SCHOLAR.oracleId,
  name: YOUTHFUL_SCHOLAR.name,
  triggers: [
    {
      abilityId: 'dies-draw',
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
      label: () => 'Youthful Scholar — draw two cards',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
