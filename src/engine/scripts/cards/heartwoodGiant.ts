// `Heartwood Giant` — "{T}, Sacrifice a Forest: This creature deals 2 damage
// to target player or planeswalker." Dark Heart of the Wood's FOREST
// predicate riding D168's chooser, aimed with Flamekin Spitfire's damage
// build — the applyAs branch written at first cut (D174's lesson), though a
// Giant carries no infect. M6.4w, D179.

import { HEARTWOOD_GIANT } from '../../../data/fixtures/engineCards';
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
  HEARTWOOD_GIANT,
  '{T}, Sacrifice a Forest: This creature deals 2 damage to target player or planeswalker.',
);

export const HEARTWOOD_GIANT_SCRIPT: CardScript = {
  oracleId: HEARTWOOD_GIANT.oracleId,
  name: HEARTWOOD_GIANT.name,
  activated: [
    {
      ref: `${HEARTWOOD_GIANT.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target) return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield')
          return [];
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target:
                  target.kind === 'player'
                    ? { kind: 'player', id: target.id }
                    : { kind: 'card', id: target.id },
                amount: 2,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect')
                  ? target.kind === 'player'
                    ? 'poison'
                    : 'wither'
                  : d.keywords.has('wither') && target.kind === 'card'
                    ? 'wither'
                    : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
