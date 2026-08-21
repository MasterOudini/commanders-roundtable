// `Righteous Cause` — "Whenever a creature attacks, you gain 1 life."
// The FOURTH perItem consumer: D190's fan-out over AttackersDeclared
// fires once per attacking creature, ANY controller's. D240.

import { RIGHTEOUS_CAUSE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RIGHTEOUS_CAUSE, 'Whenever a creature attacks, you gain 1 life.');

export const RIGHTEOUS_CAUSE_SCRIPT: CardScript = {
  oracleId: RIGHTEOUS_CAUSE.oracleId,
  name: RIGHTEOUS_CAUSE.name,
  triggers: [
    {
      abilityId: 'attacks-gain',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.length > 0,
      // One firing PER ATTACKING CREATURE, whoever controls it.
      perItem: (_ctx, _self, ev) =>
        ev.t === 'AttackersDeclared' ? ev.attackers.map((a) => a.card) : [],
      label: () => 'Righteous Cause — you gain 1 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: player.life + 1 }];
      },
    },
  ],
};
