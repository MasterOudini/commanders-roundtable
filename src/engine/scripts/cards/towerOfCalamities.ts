// `Tower of Calamities` — one of four {4} artifacts whose whole text is
// `{8}, {T}:` and four DIFFERENT payloads. The COST repeats across the cycle
// and the resolve does not, which is why these four are hand-written rather
// than generated: the family idiom (D252 Staffs, D257 Temples, D258/D261
// Spheres) earns its keep when the PAYLOAD SHAPE repeats too. D261.

import { TOWER_OF_CALAMITIES } from '../../../data/fixtures/engineCards';
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
  TOWER_OF_CALAMITIES,
  '{8}, {T}: This artifact deals 12 damage to target creature.',
);

export const TOWER_OF_CALAMITIES_SCRIPT: CardScript = {
  oracleId: TOWER_OF_CALAMITIES.oracleId,
  name: TOWER_OF_CALAMITIES.name,
  activated: [
    {
      ref: `${TOWER_OF_CALAMITIES.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        // The SOURCE is the Tower itself, so its own derived keywords decide
        // how the damage lands — the artifact has none of them today, and
        // reading them anyway is what makes a granted deathtouch work.
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'card', id: target.id },
                amount: 12,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
