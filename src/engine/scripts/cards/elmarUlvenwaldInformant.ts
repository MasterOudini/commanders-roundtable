// `Elmar, Ulvenwald Informant` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELMAR_ULVENWALD_INFORMANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELMAR_ULVENWALD_INFORMANT, "Haste\nWhenever you cast your second spell each turn, untap target creature, then investigate. (Create a colorless Clue artifact token with \"{2}, Sacrifice this artifact: Draw a card.\")\nPartner—Friends forever (You can have two commanders if both have this ability.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap target creature, then investigate.", ELMAR_ULVENWALD_INFORMANT.name);
const VOCAB_T_L1 = vocabularyTargets("Untap target creature, then investigate.");

export const ELMAR_ULVENWALD_INFORMANT_SCRIPT: CardScript = {
  oracleId: ELMAR_ULVENWALD_INFORMANT.oracleId,
  name: ELMAR_ULVENWALD_INFORMANT.name,
  triggers: [
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Elmar, Ulvenwald Informant - Untap target creature, then investigate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
