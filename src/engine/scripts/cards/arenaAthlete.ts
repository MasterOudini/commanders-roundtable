// `Arena Athlete` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARENA_ATHLETE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARENA_ATHLETE, "Heroic — Whenever you cast a spell that targets this creature, target creature an opponent controls can't block this turn.");

const VOCAB_L0 = vocabularyEffects("Target creature an opponent controls can't block this turn.", ARENA_ATHLETE.name);
const VOCAB_T_L0 = vocabularyTargets("Target creature an opponent controls can't block this turn.");

export const ARENA_ATHLETE_SCRIPT: CardScript = {
  oracleId: ARENA_ATHLETE.oracleId,
  name: ARENA_ATHLETE.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Arena Athlete - Target creature an opponent controls can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
