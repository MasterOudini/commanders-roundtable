// `Bloated Contaminator` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLOATED_CONTAMINATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLOATED_CONTAMINATOR, "Trample\nToxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nWhenever this creature deals combat damage to a player, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Proliferate.", BLOATED_CONTAMINATOR.name);
const VOCAB_T_L2 = vocabularyTargets("Proliferate.");

export const BLOATED_CONTAMINATOR_SCRIPT: CardScript = {
  oracleId: BLOATED_CONTAMINATOR.oracleId,
  name: BLOATED_CONTAMINATOR.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Bloated Contaminator - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
