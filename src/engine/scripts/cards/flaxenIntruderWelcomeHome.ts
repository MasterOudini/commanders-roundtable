// `Flaxen Intruder // Welcome Home` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLAXEN_INTRUDER_WELCOME_HOME } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(FLAXEN_INTRUDER_WELCOME_HOME, "Whenever this creature deals combat damage to a player, you may sacrifice it. When you do, destroy target artifact or enchantment.\nCreate three 2/2 green Bear creature tokens. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may sacrifice it. When you do, destroy target artifact or enchantment.", FLAXEN_INTRUDER_WELCOME_HOME.name);
const VOCAB_T_L0 = vocabularyTargets("You may sacrifice it. When you do, destroy target artifact or enchantment.");

export const FLAXEN_INTRUDER_WELCOME_HOME_SCRIPT: CardScript = {
  oracleId: FLAXEN_INTRUDER_WELCOME_HOME.oracleId,
  name: FLAXEN_INTRUDER_WELCOME_HOME.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0', face: 0,
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Flaxen Intruder // Welcome Home - You may sacrifice it. When you do, destroy target artifact or enchantment.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
