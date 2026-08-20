// `Cleansing Beam` — "Radiance — Cleansing Beam deals 2 damage to target
// creature and each other creature that shares a color with it."
// Brightflame's set at a flat 2 with no gain. D203.

import { CLEANSING_BEAM } from '../../../data/fixtures/engineCards';
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
  CLEANSING_BEAM,
  'Radiance — Cleansing Beam deals 2 damage to target creature and each other creature that shares a color with it.',
);

export const CLEANSING_BEAM_SCRIPT: CardScript = {
  oracleId: CLEANSING_BEAM.oracleId,
  name: CLEANSING_BEAM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const shared = new Set(ctx.derive(target.id).colors);
      const hit = [target.id];
      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.some((c) => shared.has(c))) continue;
        hit.push(id);
      }
      return [
        {
          t: 'DamageDealt',
          damages: hit.map((id) => ({
            source: self,
            target: { kind: 'card' as const, id },
            amount: 2,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          })),
        },
      ];
    },
  },
};
