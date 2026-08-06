// `Barrage Ogre` — "{T}, Sacrifice an artifact: This creature deals 2 damage
// to any target." The chooser's artifact predicate plus a tap in one cost;
// the damage carries the derived source's riders (a lifelinked Ogre heals).
// M6.4l, D169.

import { BARRAGE_OGRE } from '../../../data/fixtures/engineCards';
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
  BARRAGE_OGRE,
  '{T}, Sacrifice an artifact: This creature deals 2 damage to any target.',
);

export const BARRAGE_OGRE_SCRIPT: CardScript = {
  oracleId: BARRAGE_OGRE.oracleId,
  name: BARRAGE_OGRE.name,
  activated: [
    {
      ref: `${BARRAGE_OGRE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        if (target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind !== 'battlefield') {
          return [];
        }
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
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
                applyAs:
                  target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
