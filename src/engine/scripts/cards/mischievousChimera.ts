// `Mischievous Chimera` - a castInOpponentsTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MISCHIEVOUS_CHIMERA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MISCHIEVOUS_CHIMERA, "Flying\nWhenever you cast your first spell during each opponent's turn, this creature deals 1 damage to each opponent. Scry 1.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to each opponent. Scry 1.", MISCHIEVOUS_CHIMERA.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to each opponent. Scry 1.");

export const MISCHIEVOUS_CHIMERA_SCRIPT: CardScript = {
  oracleId: MISCHIEVOUS_CHIMERA.oracleId,
  name: MISCHIEVOUS_CHIMERA.name,
  triggers: [
    {
      abilityId: 'castInOpponentsTurn-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller && (ctx.state.turn.spellsCast[ev.obj.controller] ?? 0) === 1,
      label: () => "Mischievous Chimera - ~ deals 1 damage to each opponent. Scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
