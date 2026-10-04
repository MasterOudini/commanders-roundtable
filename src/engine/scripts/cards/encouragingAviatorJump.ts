// `Encouraging Aviator // Jump` - a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ENCOURAGING_AVIATOR_JUMP } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(ENCOURAGING_AVIATOR_JUMP, "Flying\nWhenever this creature attacks, it becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nTarget creature gains flying until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ becomes prepared.", ENCOURAGING_AVIATOR_JUMP.name);
const VOCAB_T_L1 = vocabularyTargets("~ becomes prepared.");

export const ENCOURAGING_AVIATOR_JUMP_SCRIPT: CardScript = {
  oracleId: ENCOURAGING_AVIATOR_JUMP.oracleId,
  name: ENCOURAGING_AVIATOR_JUMP.name,
  triggers: [
    {
      abilityId: 'attacks-1', face: 0,
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Encouraging Aviator // Jump - ~ becomes prepared.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
