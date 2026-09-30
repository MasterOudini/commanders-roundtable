// `Corroding Dragonstorm` - a etb trigger vocab, a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CORRODING_DRAGONSTORM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CORRODING_DRAGONSTORM, "When this enchantment enters, each opponent loses 2 life and you gain 2 life. Surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)\nWhen a Dragon you control enters, return this enchantment to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Each opponent loses 2 life and you gain 2 life. Surveil 2.", CORRODING_DRAGONSTORM.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent loses 2 life and you gain 2 life. Surveil 2.");
const VOCAB_L1 = vocabularyEffects("Return this enchantment to its owner's hand.", CORRODING_DRAGONSTORM.name);
const VOCAB_T_L1 = vocabularyTargets("Return this enchantment to its owner's hand.");

export const CORRODING_DRAGONSTORM_SCRIPT: CardScript = {
  oracleId: CORRODING_DRAGONSTORM.oracleId,
  name: CORRODING_DRAGONSTORM.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Corroding Dragonstorm - Each opponent loses 2 life and you gain 2 life. Surveil 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'creatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Dragon'),
        ),
      label: () => "Corroding Dragonstorm - Return this enchantment to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
