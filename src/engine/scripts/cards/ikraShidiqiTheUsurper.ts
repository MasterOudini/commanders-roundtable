// `Ikra Shidiqi, the Usurper` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { IKRA_SHIDIQI_THE_USURPER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(IKRA_SHIDIQI_THE_USURPER, "Menace\nWhenever a creature you control deals combat damage to a player, you gain life equal to that creature's toughness.\nPartner (You can have two commanders if both have partner.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You gain life equal to target creature's toughness.", IKRA_SHIDIQI_THE_USURPER.name);
const VOCAB_T_L1 = vocabularyTargets("You gain life equal to target creature's toughness.");

export const IKRA_SHIDIQI_THE_USURPER_SCRIPT: CardScript = {
  oracleId: IKRA_SHIDIQI_THE_USURPER.oracleId,
  name: IKRA_SHIDIQI_THE_USURPER.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)).map((d) => d.source))] : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)),
      label: () => "Ikra Shidiqi, the Usurper - You gain life equal to target creature's toughness.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
