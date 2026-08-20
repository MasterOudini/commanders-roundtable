// `Burn the Impure` — "Burn the Impure deals 3 damage to target creature.
// If that creature has infect, Burn the Impure deals 3 damage to that
// creature's controller." The rider reads the DERIVED keyword — a granted
// infect counts. D202.

import { BURN_THE_IMPURE } from '../../../data/fixtures/engineCards';
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
  BURN_THE_IMPURE,
  "Burn the Impure deals 3 damage to target creature. If that creature has infect, Burn the Impure deals 3 damage to that creature's controller.",
);

export const BURN_THE_IMPURE_SCRIPT: CardScript = {
  oracleId: BURN_THE_IMPURE.oracleId,
  name: BURN_THE_IMPURE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const hit = (
        to: { kind: 'card'; id: typeof target.id } | { kind: 'player'; id: typeof card.controller },
      ) => ({
        source: self,
        target: to,
        amount: 3,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const infect = ctx.derive(target.id).keywords.has('infect');
      return [
        {
          t: 'DamageDealt',
          damages: infect
            ? [hit({ kind: 'card', id: target.id }), hit({ kind: 'player', id: card.controller })]
            : [hit({ kind: 'card', id: target.id })],
        },
      ];
    },
  },
};
