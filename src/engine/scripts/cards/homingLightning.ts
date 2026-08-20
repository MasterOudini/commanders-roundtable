// `Homing Lightning` — THE D90 CARD: the loose-prefix parser would have
// "understood" it and silently dropped the name fan; closing the
// vocabulary refused it, and a script now runs every word. 4 to the
// target and each OTHER creature sharing its name. D218.

import { HOMING_LIGHTNING } from '../../../data/fixtures/engineCards';
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
  HOMING_LIGHTNING,
  'Homing Lightning deals 4 damage to target creature and each other creature with the same name as that creature.',
);

export const HOMING_LIGHTNING_SCRIPT: CardScript = {
  oracleId: HOMING_LIGHTNING.oracleId,
  name: HOMING_LIGHTNING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const name = ctx.oracle.byPrinting(victim.printingId)?.name;
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const isTarget = id === target.id;
        if (!isTarget) {
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name !== name) continue;
        }
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 4,
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
