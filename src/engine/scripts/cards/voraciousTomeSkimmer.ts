// `Voracious Tome-Skimmer` - a castInOpponentsTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VORACIOUS_TOME_SKIMMER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VORACIOUS_TOME_SKIMMER, "Flying\nWhenever you cast a spell during an opponent's turn, you may pay 1 life. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay 1 life. If you do, draw a card.", VORACIOUS_TOME_SKIMMER.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay 1 life. If you do, draw a card.");

export const VORACIOUS_TOME_SKIMMER_SCRIPT: CardScript = {
  oracleId: VORACIOUS_TOME_SKIMMER.oracleId,
  name: VORACIOUS_TOME_SKIMMER.name,
  triggers: [
    {
      abilityId: 'castInOpponentsTurn-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller,
      label: () => "Voracious Tome-Skimmer - You may pay 1 life. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
