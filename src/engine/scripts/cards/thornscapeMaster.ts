// `Thornscape Master` - an activation damageTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORNSCAPE_MASTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORNSCAPE_MASTER, "{R}{R}, {T}: This creature deals 2 damage to target creature.\n{W}{W}, {T}: Target creature gains protection from the color of your choice until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Target creature gains protection from the color of your choice until end of turn.", THORNSCAPE_MASTER.name);
const VOCAB_T_A1 = vocabularyTargets("Target creature gains protection from the color of your choice until end of turn.");

export const THORNSCAPE_MASTER_SCRIPT: CardScript = {
  oracleId: THORNSCAPE_MASTER.oracleId,
  name: THORNSCAPE_MASTER.name,
  activated: [
    {
      ref: `${THORNSCAPE_MASTER.oracleId}#a0`,
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
      ref: `${THORNSCAPE_MASTER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
