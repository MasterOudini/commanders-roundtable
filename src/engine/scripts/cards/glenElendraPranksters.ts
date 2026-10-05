// `Glen Elendra Pranksters` - a castInOpponentsTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLEN_ELENDRA_PRANKSTERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLEN_ELENDRA_PRANKSTERS, "Flying\nWhenever you cast a spell during an opponent's turn, you may return target creature you control to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return target creature you control to its owner's hand.", GLEN_ELENDRA_PRANKSTERS.name);
const VOCAB_T_L1 = vocabularyTargets("Return target creature you control to its owner's hand.");

export const GLEN_ELENDRA_PRANKSTERS_SCRIPT: CardScript = {
  oracleId: GLEN_ELENDRA_PRANKSTERS.oracleId,
  name: GLEN_ELENDRA_PRANKSTERS.name,
  triggers: [
    {
      abilityId: 'castInOpponentsTurn-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller,
      label: () => "Glen Elendra Pranksters - Return target creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
