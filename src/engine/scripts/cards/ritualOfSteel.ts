// `Ritual of Steel` - a etb trigger vocab, a static attachedStatic
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RITUAL_OF_STEEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RITUAL_OF_STEEL, "Enchant creature\nWhen this Aura enters, draw a card at the beginning of the next turn's upkeep.\nEnchanted creature gets +0/+2.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Draw a card at the beginning of the next turn's upkeep.", RITUAL_OF_STEEL.name);
const VOCAB_T_L1 = vocabularyTargets("Draw a card at the beginning of the next turn's upkeep.");

export const RITUAL_OF_STEEL_SCRIPT: CardScript = {
  oracleId: RITUAL_OF_STEEL.oracleId,
  name: RITUAL_OF_STEEL.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ritual of Steel - Draw a card at the beginning of the next turn's upkeep.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 0;
        if (chars.toughness !== null) chars.toughness += 2;
      },
    },
  ],
};
