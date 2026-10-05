// `Ledger Shredder` - a secondSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEDGER_SHREDDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEDGER_SHREDDER, "Flying\nWhenever a player casts their second spell each turn, this creature connives. (Draw a card, then discard a card. If you discarded a nonland card, put a +1/+1 counter on this creature.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ connives.", LEDGER_SHREDDER.name);
const VOCAB_T_L1 = vocabularyTargets("~ connives.");

export const LEDGER_SHREDDER_SCRIPT: CardScript = {
  oracleId: LEDGER_SHREDDER.oracleId,
  name: LEDGER_SHREDDER.name,
  triggers: [
    {
      abilityId: 'secondSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, _self, ev) => ev.t === 'SpellCast' && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 2,
      label: () => "Ledger Shredder - ~ connives.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
