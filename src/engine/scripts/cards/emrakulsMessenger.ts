// `Emrakul's Messenger` - a secondCard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMRAKUL_S_MESSENGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMRAKUL_S_MESSENGER, "Devoid (This card has no color.)\nFlying\nWhenever you draw your second card each turn, create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"", EMRAKUL_S_MESSENGER.name);
const VOCAB_T_L2 = vocabularyTargets("Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"");

export const EMRAKULS_MESSENGER_SCRIPT: CardScript = {
  oracleId: EMRAKUL_S_MESSENGER.oracleId,
  name: EMRAKUL_S_MESSENGER.name,
  triggers: [
    {
      abilityId: 'secondCard-2',
      text: LINES[2] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Emrakul's Messenger - Create a 0/1 colorless Eldrazi Spawn creature token with \"Sacrifice this token: Add {C}.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
