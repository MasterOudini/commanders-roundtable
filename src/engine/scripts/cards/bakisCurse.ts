// `Baki's Curse` — "Baki's Curse deals 2 damage to each creature for each
// Aura attached to that creature." Per-creature amounts computed from the
// attachments array (Auras only, by DERIVED subtype), all entries in one
// DamageDealt. The SPELL is the source — no riders (Acidic Soil's rule).
// D199.

import { BAKI_S_CURSE } from '../../../data/fixtures/engineCards';
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
  BAKI_S_CURSE,
  "Baki's Curse deals 2 damage to each creature for each Aura attached to that creature.",
);

export const BAKIS_CURSE_SCRIPT: CardScript = {
  oracleId: BAKI_S_CURSE.oracleId,
  name: BAKI_S_CURSE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        let auras = 0;
        for (const att of card.attachments) {
          const a = ctx.state.cards[att];
          if (!a || a.zone.kind !== 'battlefield') continue;
          if (ctx.derive(att).typeLine.subtypes.includes('Aura')) auras++;
        }
        if (auras === 0) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 2 * auras,
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
