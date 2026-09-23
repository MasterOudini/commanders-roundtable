// `Orochi Soul-Reaver` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OROCHI_SOUL_REAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OROCHI_SOUL_REAVER, "Ninjutsu {3}{B} ({3}{B}, Return an unblocked attacker you control to hand: Put this card onto the battlefield from your hand tapped and attacking.)\nWhenever one or more creatures you control deal combat damage to a player, create a Treasure token and manifest the top card of that player's library. (Put it onto the battlefield face down as a 2/2 creature. Turn it face up any time for its mana cost if it's a creature card.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a Treasure token and manifest the top card of that player's library.", OROCHI_SOUL_REAVER.name);
const VOCAB_T_L1 = vocabularyTargets("Create a Treasure token and manifest the top card of that player's library.");

export const OROCHI_SOUL_REAVER_SCRIPT: CardScript = {
  oracleId: OROCHI_SOUL_REAVER.oracleId,
  name: OROCHI_SOUL_REAVER.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature')),
      label: () => "Orochi Soul-Reaver - Create a Treasure token and manifest the top card of that player's library.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
