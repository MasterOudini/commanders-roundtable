// `Judgment Bolt` — 5 at the creature, plus the Equipment census at its
// controller (read pre-move). D221.

import { JUDGMENT_BOLT } from '../../../data/fixtures/engineCards';
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
  JUDGMENT_BOLT,
  "Judgment Bolt deals 5 damage to target creature and X damage to that creature's controller, where X is the number of Equipment you control.",
);

export const JUDGMENT_BOLT_SCRIPT: CardScript = {
  oracleId: JUDGMENT_BOLT.oracleId,
  name: JUDGMENT_BOLT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const controller = victim.controller;
      let x = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Equipment')) x++;
      }
      const damages = [];
      damages.push({
        source: self,
        target: { kind: 'card' as const, id: target.id },
        amount: 5,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      if (x > 0 && !ctx.state.players[controller]?.hasLost) {
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: controller },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
