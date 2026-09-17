// `Spawnwrithe` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPAWNWRITHE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPAWNWRITHE, "Trample\nWhenever this creature deals combat damage to a player, create a token that's a copy of this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a token that's a copy of this creature.", SPAWNWRITHE.name);
const VOCAB_T_L1 = vocabularyTargets("Create a token that's a copy of this creature.");

export const SPAWNWRITHE_SCRIPT: CardScript = {
  oracleId: SPAWNWRITHE.oracleId,
  name: SPAWNWRITHE.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Spawnwrithe - Create a token that's a copy of this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
