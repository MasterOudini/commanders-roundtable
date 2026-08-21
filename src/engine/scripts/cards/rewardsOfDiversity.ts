// `Rewards of Diversity` — "Whenever an opponent casts a multicolored
// spell, you gain 4 life." Hero of Precinct One's colour COUNT of the
// cast face, behind Insight's opponent filter. D240.

import { REWARDS_OF_DIVERSITY } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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

const TEXT = printed(
  REWARDS_OF_DIVERSITY,
  'Whenever an opponent casts a multicolored spell, you gain 4 life.',
);

export const REWARDS_OF_DIVERSITY_SCRIPT: CardScript = {
  oracleId: REWARDS_OF_DIVERSITY.oracleId,
  name: REWARDS_OF_DIVERSITY.name,
  triggers: [
    {
      abilityId: 'opponent-multicolored-gain',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        if (ev.obj.controller === ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return faceOf(oc, ev.obj.faceIndex).colors.length >= 2;
      },
      label: () => 'Rewards of Diversity — you gain 4 life',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 4, to: player.life + 4 }];
      },
    },
  ],
};
