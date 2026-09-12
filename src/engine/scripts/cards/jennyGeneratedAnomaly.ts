// `Jenny, Generated Anomaly` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { JENNY_GENERATED_ANOMALY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(JENNY_GENERATED_ANOMALY, "Double strike\nWhenever Jenny deals combat damage to a player, it explores. (Reveal the top card of your library. Put that card into your hand if it's a land. Otherwise, put a +1/+1 counter on this creature, then put the card back or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ explores.", JENNY_GENERATED_ANOMALY.name);
const VOCAB_T_L1 = vocabularyTargets("~ explores.");

export const JENNY_GENERATED_ANOMALY_SCRIPT: CardScript = {
  oracleId: JENNY_GENERATED_ANOMALY.oracleId,
  name: JENNY_GENERATED_ANOMALY.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Jenny, Generated Anomaly - ~ explores.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
