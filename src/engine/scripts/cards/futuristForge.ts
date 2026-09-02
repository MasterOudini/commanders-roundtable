// `Futurist Forge` — "When this artifact enters, draw a card.\n{3}{U},
// Sacrifice this artifact: Draw two cards." A self-entry draw and a
// Cluestone-shaped sacrifice for two (D163), the sacrifice charged at
// activation (D159). D275.

import { FUTURIST_FORGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  FUTURIST_FORGE,
  'When this artifact enters, draw a card.\n{3}{U}, Sacrifice this artifact: Draw two cards.',
);
const ENTERS = PRINTED.split('\n')[0] as string;
const TWO = PRINTED.split('\n')[1] as string;

export const FUTURIST_FORGE_SCRIPT: CardScript = {
  oracleId: FUTURIST_FORGE.oracleId,
  name: FUTURIST_FORGE.name,
  triggers: [
    {
      abilityId: 'enters',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Futurist Forge — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => [...drawEvents(ctx.state, obj.controller, 1)],
    },
  ],
  activated: [
    {
      ref: `${FUTURIST_FORGE.oracleId}#a0`,
      text: TWO,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
