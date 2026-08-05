// `Celestial Force` — "At the beginning of each upkeep, you gain 3 life."
// The first SHIPPED upkeep trigger: `StepBegan`/'upkeep' with NO
// active-player filter, because "each upkeep" means all of them — the test
// registry's Ajani's Mantra carries the "your upkeep" variant. M6.4j, D167.

import { CELESTIAL_FORCE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(CELESTIAL_FORCE, 'At the beginning of each upkeep, you gain 3 life.');

export const CELESTIAL_FORCE_SCRIPT: CardScript = {
  oracleId: CELESTIAL_FORCE.oracleId,
  name: CELESTIAL_FORCE.name,
  triggers: [
    {
      abilityId: 'upkeep',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => 'Celestial Force — gain 3 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 3, to: player.life + 3 }];
      },
    },
  ],
};
