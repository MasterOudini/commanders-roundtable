// `Skyreaping` — "Skyreaping deals damage to each creature with flying equal
// to your devotion to green." Aspect of Hydra's census fanned over Gale
// Force's set: devotion off the parsed ManaCost, the sweep off the derived
// keyword. D248.

import { SKYREAPING } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  SKYREAPING,
  'Skyreaping deals damage to each creature with flying equal to your devotion to green. ' +
    '(Each {G} in the mana costs of permanents you control counts toward your devotion to green.)',
);

export const SKYREAPING_SCRIPT: CardScript = {
  oracleId: SKYREAPING.oracleId,
  name: SKYREAPING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      let devotion = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const oc = ctx.oracle.byPrinting(card.printingId);
        if (!oc) continue;
        const cost = faceOf(oc, card.faceIndex).manaCost;
        if (!cost) continue;
        devotion += cost.colored.G;
        devotion += cost.hybrids.filter((h) =>
          h.options.some((o) => o.kind === 'color' && o.color === 'G'),
        ).length;
      }
      if (devotion <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: devotion,
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
