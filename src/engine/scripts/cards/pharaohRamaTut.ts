// `Pharaoh Rama-Tut` - a castNoncreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHARAOH_RAMA_TUT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHARAOH_RAMA_TUT, "Ward {2} (Whenever this creature becomes the target of a spell or ability an opponent controls, counter it unless that player pays {2}.)\nWhenever you cast a noncreature spell, Pharaoh Rama-Tut connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ connives.", PHARAOH_RAMA_TUT.name);
const VOCAB_T_L1 = vocabularyTargets("~ connives.");

export const PHARAOH_RAMA_TUT_SCRIPT: CardScript = {
  oracleId: PHARAOH_RAMA_TUT.oracleId,
  name: PHARAOH_RAMA_TUT.name,
  triggers: [
    {
      abilityId: 'castNoncreature-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Pharaoh Rama-Tut - ~ connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
