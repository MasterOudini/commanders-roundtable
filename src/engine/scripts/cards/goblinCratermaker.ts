// `Goblin Cratermaker` - an activation damageTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_CRATERMAKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import { modesInOrder } from '../../modes';
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

const PRINTED = printed(GOBLIN_CRATERMAKER, "{1}, Sacrifice this creature: Choose one —\n• This creature deals 2 damage to target creature.\n• Destroy target colorless nonland permanent.");
const LINES = PRINTED.split('\n');

const MODES_A0 = [
  { text: "This creature deals 2 damage to target creature.", targets: vocabularyTargets("~ deals 2 damage to target creature.") },
  { text: "Destroy target colorless nonland permanent.", targets: vocabularyTargets("Destroy target colorless nonland permanent.") },
];

const VOCAB_A0_m1 = vocabularyEffects("Destroy target colorless nonland permanent.", GOBLIN_CRATERMAKER.name);
const VOCAB_T_A0_m1 = vocabularyTargets("Destroy target colorless nonland permanent.");

export const GOBLIN_CRATERMAKER_SCRIPT: CardScript = {
  oracleId: GOBLIN_CRATERMAKER.oracleId,
  name: GOBLIN_CRATERMAKER.name,
  activated: [
    {
      ref: `${GOBLIN_CRATERMAKER.oracleId}#a0`,
      text: LINES[0] as string,
      modes: MODES_A0,
      modeChoice: { min: 1, max: 1 },
      resolve: (ctx, self, obj): readonly EventBody[] => {
        // D345 - one mode resolves (choose one), so obj.targets is its own clauses.
        const chosen = modesInOrder(obj.modes)[0] ?? 0;
        if (chosen === 0) {
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
        }
        if (chosen === 1) {
          return ctx.vocabulary(obj, VOCAB_A0_m1, VOCAB_T_A0_m1);
        }
        return [];
      },
    },
  ],
};
