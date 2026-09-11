// `Sure-Footed Infiltrator` - an activation vocab, a combatDamagePlayer trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SURE_FOOTED_INFILTRATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SURE_FOOTED_INFILTRATOR, "Tap another untapped Rogue you control: This creature can't be blocked this turn.\nWhenever this creature deals combat damage to a player, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ can't be blocked this turn.", SURE_FOOTED_INFILTRATOR.name);
const VOCAB_T_A0 = vocabularyTargets("~ can't be blocked this turn.");

export const SURE_FOOTED_INFILTRATOR_SCRIPT: CardScript = {
  oracleId: SURE_FOOTED_INFILTRATOR.oracleId,
  name: SURE_FOOTED_INFILTRATOR.name,
  activated: [
    {
      ref: `${SURE_FOOTED_INFILTRATOR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Sure-Footed Infiltrator - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
