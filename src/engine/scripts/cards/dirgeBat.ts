// `Dirge Bat` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIRGE_BAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIRGE_BAT, "Mutate {4}{B}{B} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nFlash\nFlying\nWhenever this creature mutates, destroy target creature or planeswalker an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L3 = vocabularyEffects("Destroy target creature or planeswalker an opponent controls.", DIRGE_BAT.name);
const VOCAB_T_L3 = vocabularyTargets("Destroy target creature or planeswalker an opponent controls.");

export const DIRGE_BAT_SCRIPT: CardScript = {
  oracleId: DIRGE_BAT.oracleId,
  name: DIRGE_BAT.name,
  triggers: [
    {
      abilityId: 'mutates-3',
      text: LINES[3] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L3,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Dirge Bat - Destroy target creature or planeswalker an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
};
