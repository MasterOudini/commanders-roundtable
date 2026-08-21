// `Runewing` — "Flying / When this creature dies, draw a card." The
// dies-draw text behind its third keyword header. D242.

import { RUNEWING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUNEWING, 'Flying\nWhen this creature dies, draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const RUNEWING_SCRIPT: CardScript = {
  oracleId: RUNEWING.oracleId,
  name: RUNEWING.name,
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
      label: () => 'Runewing — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
