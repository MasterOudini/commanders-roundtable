// `Ghost-Lit Raider` - an activation damageTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOST_LIT_RAIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOST_LIT_RAIDER, "{2}{R}, {T}: This creature deals 2 damage to target creature.\nChannel — {3}{R}, Discard this card: It deals 4 damage to target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("It deals 4 damage to target creature.", GHOST_LIT_RAIDER.name);
const VOCAB_T_A1 = vocabularyTargets("It deals 4 damage to target creature.");

export const GHOST_LIT_RAIDER_SCRIPT: CardScript = {
  oracleId: GHOST_LIT_RAIDER.oracleId,
  name: GHOST_LIT_RAIDER.name,
  activated: [
    {
      ref: `${GHOST_LIT_RAIDER.oracleId}#a0`,
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
      ref: `${GHOST_LIT_RAIDER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
