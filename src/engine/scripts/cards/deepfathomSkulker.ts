// `Deepfathom Skulker` - a creatureCombatDamagePlayer trigger draw, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEEPFATHOM_SKULKER } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(DEEPFATHOM_SKULKER, "Devoid (This card has no color.)\nWhenever a creature you control deals combat damage to a player, you may draw a card.\n{3}{C}: Target creature can't be blocked this turn. ({C} represents colorless mana.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Target creature can't be blocked this turn.", DEEPFATHOM_SKULKER.name);
const VOCAB_T_A0 = vocabularyTargets("Target creature can't be blocked this turn.");

export const DEEPFATHOM_SKULKER_SCRIPT: CardScript = {
  oracleId: DEEPFATHOM_SKULKER.oracleId,
  name: DEEPFATHOM_SKULKER.name,
  activated: [
    {
      ref: `${DEEPFATHOM_SKULKER.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)),
      label: () => "Deepfathom Skulker - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
