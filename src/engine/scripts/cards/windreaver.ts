// `Windreaver` - an activation pumping itself, an activation pumping itself, an activation vocab, an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WINDREAVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WINDREAVER, "Flying\n{W}: This creature gains vigilance until end of turn.\n{W}: This creature gets +0/+1 until end of turn.\n{U}: Switch this creature's power and toughness until end of turn.\n{U}: Return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Switch this creature's power and toughness until end of turn.", WINDREAVER.name);
const VOCAB_T_A2 = vocabularyTargets("Switch this creature's power and toughness until end of turn.");

export const WINDREAVER_SCRIPT: CardScript = {
  oracleId: WINDREAVER.oracleId,
  name: WINDREAVER.name,
  activated: [
    {
      ref: `${WINDREAVER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["vigilance"] }];
      },
    },
    {
      ref: `${WINDREAVER.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 1 }];
      },
    },
    {
      ref: `${WINDREAVER.oracleId}#a2`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
    {
      ref: `${WINDREAVER.oracleId}#a3`,
      text: LINES[4] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
};
