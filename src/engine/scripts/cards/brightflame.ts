// `Brightflame` — "Radiance — Brightflame deals X damage to target creature
// and each other creature that shares a color with it. You gain life equal
// to the damage dealt this way." The radiance set is DERIVED colors; the
// gain is X per creature actually hit. D201.

import { BRIGHTFLAME } from '../../../data/fixtures/engineCards';
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
  BRIGHTFLAME,
  'Radiance — Brightflame deals X damage to target creature and each other creature that shares a color with it. You gain life equal to the damage dealt this way.',
);

export const BRIGHTFLAME_SCRIPT: CardScript = {
  oracleId: BRIGHTFLAME.oracleId,
  name: BRIGHTFLAME.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const shared = new Set(ctx.derive(target.id).colors);
      const hit = [target.id];
      for (const id of ctx.state.zones.battlefield) {
        if (id === target.id) continue;
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.some((c) => shared.has(c))) continue;
        hit.push(id);
      }
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: hit.map((id) => ({
            source: self,
            target: { kind: 'card' as const, id },
            amount: x,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          })),
        },
      ];
      const gained = x * hit.length;
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      events.push({ t: 'LifeChanged', player: obj.controller, delta: gained, to: life + gained });
      return events;
    },
  },
};
