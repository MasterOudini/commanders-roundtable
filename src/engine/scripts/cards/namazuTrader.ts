// `Namazu Trader` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { NAMAZU_TRADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(NAMAZU_TRADER, "When this creature enters, you lose 1 life and create a Treasure token.\nWhenever this creature attacks, you may sacrifice another creature or artifact. If you do, surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You lose 1 life and create a Treasure token.", NAMAZU_TRADER.name);
const VOCAB_T_L0 = vocabularyTargets("You lose 1 life and create a Treasure token.");
const VOCAB_L1 = vocabularyEffects("You may sacrifice another creature or artifact. If you do, surveil 2.", NAMAZU_TRADER.name);
const VOCAB_T_L1 = vocabularyTargets("You may sacrifice another creature or artifact. If you do, surveil 2.");

export const NAMAZU_TRADER_SCRIPT: CardScript = {
  oracleId: NAMAZU_TRADER.oracleId,
  name: NAMAZU_TRADER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Namazu Trader - You lose 1 life and create a Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Namazu Trader - You may sacrifice another creature or artifact. If you do, surveil 2.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
