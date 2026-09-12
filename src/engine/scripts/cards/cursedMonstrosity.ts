// `Cursed Monstrosity` - a becomesTargeted trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CURSED_MONSTROSITY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CURSED_MONSTROSITY, "Flying\nWhenever this creature becomes the target of a spell or ability, sacrifice it unless you discard a land card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Sacrifice it unless you discard a land card.", CURSED_MONSTROSITY.name);
const VOCAB_T_L1 = vocabularyTargets("Sacrifice it unless you discard a land card.");

export const CURSED_MONSTROSITY_SCRIPT: CardScript = {
  oracleId: CURSED_MONSTROSITY.oracleId,
  name: CURSED_MONSTROSITY.name,
  triggers: [
    {
      abilityId: 'becomesTargeted-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cursed Monstrosity - Sacrifice it unless you discard a land card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'becomesTargetedAbility-1',
      text: LINES[1] as string,
      event: 'AbilityPutOnStack',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AbilityPutOnStack' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cursed Monstrosity - Sacrifice it unless you discard a land card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
