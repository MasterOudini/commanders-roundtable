// `Warpath` — Fight to the Death's exact combat set with damage instead of
// destruction: every BLOCKING creature, plus every creature any of them
// blocked. `combat.blockers` carries each blocker and its `attackerOrder`,
// and the union is the whole clause — an unblocked attacker is in neither
// half. D268.

import { WARPATH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  WARPATH,
  'Warpath deals 3 damage to each blocking creature and each blocked creature.',
);

export const WARPATH_SCRIPT: CardScript = {
  oracleId: WARPATH.oracleId,
  name: WARPATH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self): readonly EventBody[] => {
      const combat = ctx.state.combat;
      if (!combat) return [];
      const hit = new Set<InstanceId>();
      for (const b of combat.blockers) {
        hit.add(b.card);
        for (const a of b.attackerOrder) hit.add(a);
      }
      const damages = [];
      for (const id of hit) {
        const card = ctx.state.cards[id];
        if (!card || card.zone.kind !== 'battlefield') continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 3,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
