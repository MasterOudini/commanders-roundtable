// `Pollenbright Wings` - a static attachedStatic, a enchantedCreatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POLLENBRIGHT_WINGS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POLLENBRIGHT_WINGS, "Enchant creature\nEnchanted creature has flying.\nWhenever enchanted creature deals combat damage to a player, create that many 1/1 green Saproling creature tokens.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create that many 1/1 green Saproling creature tokens.", POLLENBRIGHT_WINGS.name, { memo: true });
const VOCAB_T_L2 = vocabularyTargets("Create that many 1/1 green Saproling creature tokens.");

export const POLLENBRIGHT_WINGS_SCRIPT: CardScript = {
  oracleId: POLLENBRIGHT_WINGS.oracleId,
  name: POLLENBRIGHT_WINGS.name,
  triggers: [
    {
      abilityId: 'enchantedCreatureCombatDamagePlayer-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (ctx, self, ev) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player').reduce((n, d) => n + d.amount, 0) : 0),
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === ctx.state.cards[self]?.attachedTo && d.target.kind === 'player' && d.amount > 0),
      label: () => "Pollenbright Wings - Create that many 1/1 green Saproling creature tokens.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("flying");
      },
    },
  ],
};
