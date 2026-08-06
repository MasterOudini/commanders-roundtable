// `Courier Griffin` — "Flying\nWhen this creature enters, you gain 2 life."
// The ETB gain, index-1 line behind an engine keyword. M6.4l, D169.

import { COURIER_GRIFFIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COURIER_GRIFFIN, 'Flying\nWhen this creature enters, you gain 2 life.');
const TEXT = PRINTED.split('\n')[1] as string;

export const COURIER_GRIFFIN_SCRIPT: CardScript = {
  oracleId: COURIER_GRIFFIN.oracleId,
  name: COURIER_GRIFFIN.name,
  triggers: [
    {
      abilityId: 'etb',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Courier Griffin — you gain 2 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 2, to: player.life + 2 }];
      },
    },
  ],
};
