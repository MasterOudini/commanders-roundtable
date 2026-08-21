// `Seismic Wave` — "deals 2 damage to any target and 1 damage to each
// nonartifact creature target opponent controls." TWO probed specs in
// one sentence; the mixed fan rides the hit() helper. D245.

import { SEISMIC_WAVE } from '../../../data/fixtures/engineCards';
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
  SEISMIC_WAVE,
  'Seismic Wave deals 2 damage to any target and 1 damage to each nonartifact creature target opponent controls.',
);

export const SEISMIC_WAVE_SCRIPT: CardScript = {
  oracleId: SEISMIC_WAVE.oracleId,
  name: SEISMIC_WAVE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const first = obj.targets[0];
      const opponent = obj.targets[1];
      if (!first || first.kind === 'stack') return [];
      if (first.kind === 'card' && ctx.state.cards[first.id]?.zone.kind !== 'battlefield')
        return [];
      const hit = (
        to: { kind: 'card'; id: string } | { kind: 'player'; id: string },
        amount: number,
      ) => ({
        source: self,
        target: to,
        amount,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      const damages = [
        hit(
          first.kind === 'player'
            ? { kind: 'player', id: first.id }
            : { kind: 'card', id: first.id },
          2,
        ),
      ];
      if (opponent && opponent.kind === 'player') {
        for (const id of ctx.state.zones.battlefield) {
          const card = ctx.state.cards[id];
          if (!card || card.controller !== opponent.id) continue;
          const d = ctx.derive(id);
          if (!d.typeLine.types.includes('Creature')) continue;
          if (d.typeLine.types.includes('Artifact')) continue;
          damages.push(hit({ kind: 'card', id }, 1));
        }
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
