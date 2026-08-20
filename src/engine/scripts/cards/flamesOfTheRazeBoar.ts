// `Flames of the Raze-Boar` — "Flames of the Raze-Boar deals 4 damage to
// target creature an opponent controls. Then Flames of the Raze-Boar deals
// 2 damage to each other creature that player controls if you control a
// creature with power 4 or greater." The fan is conditional on MY board
// and excludes the target itself. D214.

import { FLAMES_OF_THE_RAZE_BOAR } from '../../../data/fixtures/engineCards';
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
  FLAMES_OF_THE_RAZE_BOAR,
  'Flames of the Raze-Boar deals 4 damage to target creature an opponent controls. Then Flames of the Raze-Boar deals 2 damage to each other creature that player controls if you control a creature with power 4 or greater.',
);

export const FLAMES_OF_THE_RAZE_BOAR_SCRIPT: CardScript = {
  oracleId: FLAMES_OF_THE_RAZE_BOAR.oracleId,
  name: FLAMES_OF_THE_RAZE_BOAR.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];
      const owner = victim.controller;
      const damages = [];
      damages.push({
        source: self,
        target: { kind: 'card' as const, id: target.id },
        amount: 4,
        deathtouch: false,
        lifelinkTo: null,
        isCommanderDamage: false,
        viaTrample: 0,
        toxic: 0,
        applyAs: 'normal' as const,
      });
      let bigOnMySide = false;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if ((d.power ?? 0) >= 4) {
          bigOnMySide = true;
          break;
        }
      }
      if (bigOnMySide) {
        for (const id of ctx.state.zones.battlefield) {
          const card = ctx.state.cards[id];
          if (!card || card.controller !== owner || id === target.id) continue;
          if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
          damages.push({
            source: self,
            target: { kind: 'card' as const, id },
            amount: 2,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          });
        }
      }
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
