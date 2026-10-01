// `Grateful Apparition` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GRATEFUL_APPARITION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GRATEFUL_APPARITION, "Flying\nWhenever this creature deals combat damage to a player or planeswalker, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Proliferate.", GRATEFUL_APPARITION.name);
const VOCAB_T_L1 = vocabularyTargets("Proliferate.");

export const GRATEFUL_APPARITION_SCRIPT: CardScript = {
  oracleId: GRATEFUL_APPARITION.oracleId,
  name: GRATEFUL_APPARITION.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.amount > 0 && (d.target.kind === 'player' || (d.target.kind === 'card' && ctx.derive(d.target.id).typeLine.types.includes('Planeswalker')))),
      label: () => "Grateful Apparition - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
