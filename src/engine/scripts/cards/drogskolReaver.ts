// `Drogskol Reaver` — "Whenever you gain life, draw a card." The FIRST
// `LifeChanged` consumer (D172): the bus dispatches per gain EVENT, which is
// the granularity the card means, and drawing does not gain life so the loop
// closes itself. Its own lifelink is the intended engine: connect, gain,
// draw. Lines 0–2 are Tier-2 keywords (reminder text and all); the def owes
// the last line. M6.4p, D172.

import { DROGSKOL_REAVER } from '../../../data/fixtures/engineCards';
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
  DROGSKOL_REAVER,
  'Flying\nDouble strike (This creature deals both first-strike and regular combat damage.)\n' +
    'Lifelink (Damage dealt by this creature also causes you to gain that much life.)\n' +
    'Whenever you gain life, draw a card.',
);
const TEXT = PRINTED.split('\n')[3] as string;

export const DROGSKOL_REAVER_SCRIPT: CardScript = {
  oracleId: DROGSKOL_REAVER.oracleId,
  name: DROGSKOL_REAVER.name,
  triggers: [
    {
      abilityId: 'gain-draw',
      text: TEXT,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'LifeChanged' &&
        ev.delta > 0 &&
        ev.player === ctx.query.controllerOf(self),
      label: () => 'Drogskol Reaver — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
