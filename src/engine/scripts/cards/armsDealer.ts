// `Arms Dealer` — "{1}{R}, Sacrifice a Goblin: This creature deals 4 damage
// to target creature." The chooser's first SUBTYPE predicate (a Goblin pays,
// nothing else), with the damage built the way `damageTo` builds it — the
// derived source's keywords decide deathtouch/lifelink/infect. M6.4l, D169.

import { ARMS_DEALER } from '../../../data/fixtures/engineCards';
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
  ARMS_DEALER,
  '{1}{R}, Sacrifice a Goblin: This creature deals 4 damage to target creature.',
);

export const ARMS_DEALER_SCRIPT: CardScript = {
  oracleId: ARMS_DEALER.oracleId,
  name: ARMS_DEALER.name,
  activated: [
    {
      ref: `${ARMS_DEALER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        const d = ctx.derive(self);
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'card', id: target.id },
                amount: 4,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount,
                applyAs: d.keywords.has('infect') || d.keywords.has('wither') ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
