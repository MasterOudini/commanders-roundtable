// `Riptide Crab` — "Vigilance / When this creature dies, draw a card."
// The dies-draw behind a keyword line: Outlaw Medic's exact shape with
// Vigilance for Lifelink. D240.

import { RIPTIDE_CRAB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIPTIDE_CRAB, 'Vigilance\nWhen this creature dies, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const RIPTIDE_CRAB_SCRIPT: CardScript = {
  oracleId: RIPTIDE_CRAB.oracleId,
  name: RIPTIDE_CRAB.name,
  triggers: [
    {
      abilityId: 'dies-draw',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Riptide Crab — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
