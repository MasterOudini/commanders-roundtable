// `Fire Nation Occupation` - a etb trigger vocab, a castInOpponentsTurn trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIRE_NATION_OCCUPATION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIRE_NATION_OCCUPATION, "When this enchantment enters, create a 2/2 red Soldier creature token with firebending 1. (Whenever it attacks, add {R}. This mana lasts until end of combat.)\nWhenever you cast a spell during an opponent's turn, create a 2/2 red Soldier creature token with firebending 1.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a 2/2 red Soldier creature token with firebending 1.", FIRE_NATION_OCCUPATION.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 2/2 red Soldier creature token with firebending 1.");
const VOCAB_L1 = vocabularyEffects("Create a 2/2 red Soldier creature token with firebending 1.", FIRE_NATION_OCCUPATION.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 2/2 red Soldier creature token with firebending 1.");

export const FIRE_NATION_OCCUPATION_SCRIPT: CardScript = {
  oracleId: FIRE_NATION_OCCUPATION.oracleId,
  name: FIRE_NATION_OCCUPATION.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Fire Nation Occupation - Create a 2/2 red Soldier creature token with firebending 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'castInOpponentsTurn-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ctx.state.turn.activePlayer !== ev.obj.controller,
      label: () => "Fire Nation Occupation - Create a 2/2 red Soldier creature token with firebending 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
