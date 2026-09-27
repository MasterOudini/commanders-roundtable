// `Roadkill Rodney` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROADKILL_RODNEY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROADKILL_RODNEY, "Squad {3} (As an additional cost to cast this spell, you may pay {3} any number of times. When this creature enters, create that many tokens that are copies of it.)\nDeathtouch\nWhenever this creature deals combat damage to a player, create a Mutagen token.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create a Mutagen token.", ROADKILL_RODNEY.name);
const VOCAB_T_L2 = vocabularyTargets("Create a Mutagen token.");

export const ROADKILL_RODNEY_SCRIPT: CardScript = {
  oracleId: ROADKILL_RODNEY.oracleId,
  name: ROADKILL_RODNEY.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-2',
      text: LINES[2] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Roadkill Rodney - Create a Mutagen token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
