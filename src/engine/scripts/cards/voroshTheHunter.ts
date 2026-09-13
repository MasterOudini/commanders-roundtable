// `Vorosh, the Hunter` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOROSH_THE_HUNTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOROSH_THE_HUNTER, "Flying\nWhenever Vorosh deals combat damage to a player, you may pay {2}{G}. If you do, put six +1/+1 counters on Vorosh.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {2}{G}. If you do, put six +1/+1 counters on ~.", VOROSH_THE_HUNTER.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {2}{G}. If you do, put six +1/+1 counters on ~.");

export const VOROSH_THE_HUNTER_SCRIPT: CardScript = {
  oracleId: VOROSH_THE_HUNTER.oracleId,
  name: VOROSH_THE_HUNTER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Vorosh, the Hunter - You may pay {2}{G}. If you do, put six +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
