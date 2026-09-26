// `Gloryheath Lynx` - a attacksWhileSaddled trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLORYHEATH_LYNX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLORYHEATH_LYNX, "Lifelink\nWhenever this creature attacks while saddled, search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.\nSaddle 2 (Tap any number of other creatures you control with total power 2 or more: This Mount becomes saddled until end of turn. Saddle only as a sorcery.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.", GLORYHEATH_LYNX.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.");

export const GLORYHEATH_LYNX_SCRIPT: CardScript = {
  oracleId: GLORYHEATH_LYNX.oracleId,
  name: GLORYHEATH_LYNX.name,
  triggers: [
    {
      abilityId: 'attacksWhileSaddled-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self) && ctx.state.untilEndOfTurn.some((m) => m.card === self && m.saddled === true),
      label: () => "Gloryheath Lynx - Search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
