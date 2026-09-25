// `Chakram Retriever` - a castSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHAKRAM_RETRIEVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CHAKRAM_RETRIEVER, "Partner with Chakram Slinger (When this creature enters, target player may put Chakram Slinger into their hand from their library, then shuffle.)\nWhenever you cast a spell during your turn, untap target creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Untap target creature.", CHAKRAM_RETRIEVER.name);
const VOCAB_T_L1 = vocabularyTargets("Untap target creature.");

export const CHAKRAM_RETRIEVER_SCRIPT: CardScript = {
  oracleId: CHAKRAM_RETRIEVER.oracleId,
  name: CHAKRAM_RETRIEVER.name,
  triggers: [
    {
      abilityId: 'castSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self)),
      label: () => "Chakram Retriever - Untap target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
