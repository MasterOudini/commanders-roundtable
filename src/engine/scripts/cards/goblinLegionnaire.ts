// `Goblin Legionnaire` - an activation damageTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_LEGIONNAIRE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(GOBLIN_LEGIONNAIRE, "{R}, Sacrifice this creature: It deals 2 damage to any target.\n{W}, Sacrifice this creature: Prevent the next 2 damage that would be dealt to any target this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Prevent the next 2 damage that would be dealt to any target this turn.", GOBLIN_LEGIONNAIRE.name);
const VOCAB_T_A1 = vocabularyTargets("Prevent the next 2 damage that would be dealt to any target this turn.");

export const GOBLIN_LEGIONNAIRE_SCRIPT: CardScript = {
  oracleId: GOBLIN_LEGIONNAIRE.oracleId,
  name: GOBLIN_LEGIONNAIRE.name,
  activated: [
    {
      ref: `${GOBLIN_LEGIONNAIRE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind === 'stack') return [];
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: target.kind === 'player' ? { kind: 'player', id: target.id } : { kind: 'card', id: target.id },
                amount: 2,
                deathtouch: d.keywords.has('deathtouch'),
                lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: d.toxicAmount ?? 0,
                applyAs: target.kind === 'player' && infect ? 'poison' : infect || wither ? 'wither' : 'normal',
              },
            ],
          },
        ];
      },
    },
    {
      ref: `${GOBLIN_LEGIONNAIRE.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
