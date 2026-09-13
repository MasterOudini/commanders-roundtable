// `Shard Phoenix` - an activation vocab, an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHARD_PHOENIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHARD_PHOENIX, "Flying (This creature can't be blocked except by creatures with flying or reach.)\nSacrifice this creature: It deals 2 damage to each creature without flying.\n{R}{R}{R}: Return this card from your graveyard to your hand. Activate only during your upkeep.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ deals 2 damage to each creature without flying.", SHARD_PHOENIX.name);
const VOCAB_T_A0 = vocabularyTargets("~ deals 2 damage to each creature without flying.");

export const SHARD_PHOENIX_SCRIPT: CardScript = {
  oracleId: SHARD_PHOENIX.oracleId,
  name: SHARD_PHOENIX.name,
  activated: [
    {
      ref: `${SHARD_PHOENIX.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${SHARD_PHOENIX.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
