// `Scroll of the Masters` - a castNoncreature trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCROLL_OF_THE_MASTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SCROLL_OF_THE_MASTERS, "Whenever you cast a noncreature spell, put a lore counter on this artifact.\n{3}, {T}: Target creature you control gets +1/+1 until end of turn for each lore counter on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a lore counter on this artifact.", SCROLL_OF_THE_MASTERS.name);
const VOCAB_T_L0 = vocabularyTargets("Put a lore counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("Target creature you control gets +1/+1 until end of turn for each lore counter on ~.", SCROLL_OF_THE_MASTERS.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature you control gets +1/+1 until end of turn for each lore counter on ~.");

export const SCROLL_OF_THE_MASTERS_SCRIPT: CardScript = {
  oracleId: SCROLL_OF_THE_MASTERS.oracleId,
  name: SCROLL_OF_THE_MASTERS.name,
  activated: [
    {
      ref: `${SCROLL_OF_THE_MASTERS.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'castNoncreature-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && !ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Scroll of the Masters - Put a lore counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
