// `Sacred Prey` — "Whenever this creature becomes blocked, you gain 1
// life." Deepwood Tantiv's watcher at 1. D242.

import { SACRED_PREY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SACRED_PREY, 'Whenever this creature becomes blocked, you gain 1 life.');

export const SACRED_PREY_SCRIPT: CardScript = {
  oracleId: SACRED_PREY.oracleId,
  name: SACRED_PREY.name,
  triggers: [
    {
      abilityId: 'blocked',
      text: TEXT,
      event: 'AttackerBecameBlocked',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackerBecameBlocked' && ev.attackers.includes(self),
      label: () => 'Sacred Prey — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
