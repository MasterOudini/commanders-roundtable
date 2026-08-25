// `Windstorm` — X damage to each creature with flying, any controller. Like
// its batch-mate `Whirlwind`, the flying test is RESOLVE-side and therefore
// reliable; it is only a TARGET noun that drops the qualifier (Wing Snare and
// Wing Puncture, both refused this batch). X=0 deals nothing. D269.

import { WINDSTORM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WINDSTORM, 'Windstorm deals X damage to each creature with flying.');

export const WINDSTORM_SCRIPT: CardScript = {
  oracleId: WINDSTORM.oracleId,
  name: WINDSTORM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const amount = obj.xValue ?? 0;
      if (amount <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount,
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
