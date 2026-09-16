// `Moria Marauder` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MORIA_MARAUDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MORIA_MARAUDER, "Double strike\nWhenever a Goblin or Orc you control deals combat damage to a player, exile the top card of your library. You may play that card this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", MORIA_MARAUDER.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

export const MORIA_MARAUDER_SCRIPT: CardScript = {
  oracleId: MORIA_MARAUDER.oracleId,
  name: MORIA_MARAUDER.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && (ctx.derive(d.source).typeLine.subtypes.includes('Goblin') || ctx.derive(d.source).typeLine.subtypes.includes('Orc'))).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && (ctx.derive(d.source).typeLine.subtypes.includes('Goblin') || ctx.derive(d.source).typeLine.subtypes.includes('Orc'))),
      label: () => "Moria Marauder - Exile the top card of your library. You may play that card this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
