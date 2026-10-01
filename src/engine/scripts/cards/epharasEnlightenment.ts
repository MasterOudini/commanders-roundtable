// `Ephara's Enlightenment` - a etb trigger vocab, a static attachedStatic, a creatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EPHARA_S_ENLIGHTENMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EPHARA_S_ENLIGHTENMENT, "Enchant creature\nWhen this Aura enters, put a +1/+1 counter on enchanted creature.\nEnchanted creature has flying.\nWhenever a creature you control enters, you may return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on enchanted creature.", EPHARA_S_ENLIGHTENMENT.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on enchanted creature.");
const VOCAB_L3 = vocabularyEffects("Return this Aura to its owner's hand.", EPHARA_S_ENLIGHTENMENT.name);
const VOCAB_T_L3 = vocabularyTargets("Return this Aura to its owner's hand.");

export const EPHARAS_ENLIGHTENMENT_SCRIPT: CardScript = {
  oracleId: EPHARA_S_ENLIGHTENMENT.oracleId,
  name: EPHARA_S_ENLIGHTENMENT.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Ephara's Enlightenment - Put a +1/+1 counter on enchanted creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'creatureEnters-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Ephara's Enlightenment - Return this Aura to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L3, VOCAB_T_L3);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
