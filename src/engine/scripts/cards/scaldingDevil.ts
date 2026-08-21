// `Scalding Devil` — "{2}{R}: This creature deals 1 damage to target
// player or planeswalker." The no-tap ping at Heartwood's compound. D243.

import { SCALDING_DEVIL } from '../../../data/fixtures/engineCards';
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
  SCALDING_DEVIL,
  '{2}{R}: This creature deals 1 damage to target player or planeswalker.',
);

export const SCALDING_DEVIL_SCRIPT: CardScript = {
  oracleId: SCALDING_DEVIL.oracleId,
  name: SCALDING_DEVIL.name,
  activated: [
    {
      ref: `${SCALDING_DEVIL.oracleId}#a0`,
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
                amount: 1,
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
