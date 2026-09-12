// `Grotag Night-Runner` - a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GROTAG_NIGHT_RUNNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GROTAG_NIGHT_RUNNER, "Whenever this creature deals combat damage to a player, exile the top card of your library. You may play that card this turn.");

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", GROTAG_NIGHT_RUNNER.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

export const GROTAG_NIGHT_RUNNER_SCRIPT: CardScript = {
  oracleId: GROTAG_NIGHT_RUNNER.oracleId,
  name: GROTAG_NIGHT_RUNNER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer-0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Grotag Night-Runner - Exile the top card of your library. You may play that card this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
