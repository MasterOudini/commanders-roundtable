// `Plague Spitter` - a upkeep trigger vocab, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLAGUE_SPITTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PLAGUE_SPITTER, "At the beginning of your upkeep, this creature deals 1 damage to each creature and each player.\nWhen this creature dies, it deals 1 damage to each creature and each player.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to each creature and each player.", PLAGUE_SPITTER.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to each creature and each player.");
const VOCAB_L1 = vocabularyEffects("~ deals 1 damage to each creature and each player.", PLAGUE_SPITTER.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 1 damage to each creature and each player.");

export const PLAGUE_SPITTER_SCRIPT: CardScript = {
  oracleId: PLAGUE_SPITTER.oracleId,
  name: PLAGUE_SPITTER.name,
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Plague Spitter - ~ deals 1 damage to each creature and each player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Plague Spitter - ~ deals 1 damage to each creature and each player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
