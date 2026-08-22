// `TCRI Building` — Swiftwater Cliffs' EXACT printed text one batch later
// (D256), on its own oracle id: the refuge shape's twin. The def claims only
// the trigger; the tapped entry is D134's built-in and the mana line is the
// engine's. D257.

import { TCRI_BUILDING } from '../../../data/fixtures/engineCards';
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
  TCRI_BUILDING,
  'This land enters tapped.\nWhen this land enters, you gain 1 life.\n{T}: Add {U} or {R}.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TCRI_BUILDING_SCRIPT: CardScript = {
  oracleId: TCRI_BUILDING.oracleId,
  name: TCRI_BUILDING.name,
  triggers: [
    {
      abilityId: 'etb-gain',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'TCRI Building — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
