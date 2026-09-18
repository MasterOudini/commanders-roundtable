// `Rakdos Guildmage` - an activation pumpTarget, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAKDOS_GUILDMAGE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAKDOS_GUILDMAGE, "({B/R} can be paid with either {B} or {R}.)\n{3}{B}, Discard a card: Target creature gets -2/-2 until end of turn.\n{3}{R}: Create a 2/1 red Goblin creature token with haste. Exile it at the beginning of the next end step.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Create a 2/1 red Goblin creature token with haste. Exile it at the beginning of the next end step.", RAKDOS_GUILDMAGE.name);
const VOCAB_T_A1 = vocabularyTargets("Create a 2/1 red Goblin creature token with haste. Exile it at the beginning of the next end step.");

export const RAKDOS_GUILDMAGE_SCRIPT: CardScript = {
  oracleId: RAKDOS_GUILDMAGE.oracleId,
  name: RAKDOS_GUILDMAGE.name,
  activated: [
    {
      ref: `${RAKDOS_GUILDMAGE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -2, toughness: -2 }];
      },
    },
    {
      ref: `${RAKDOS_GUILDMAGE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
