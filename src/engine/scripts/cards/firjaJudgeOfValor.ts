// `Firja, Judge of Valor` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRJA_JUDGE_OF_VALOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRJA_JUDGE_OF_VALOR, "Flying, lifelink\nWhenever you cast your second spell each turn, look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.", FIRJA_JUDGE_OF_VALOR.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.");

export const FIRJA_JUDGE_OF_VALOR_SCRIPT: CardScript = {
  oracleId: FIRJA_JUDGE_OF_VALOR.oracleId,
  name: FIRJA_JUDGE_OF_VALOR.name,
  triggers: [
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Firja, Judge of Valor - Look at the top three cards of your library. Put one of them into your hand and the rest into your graveyard.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
