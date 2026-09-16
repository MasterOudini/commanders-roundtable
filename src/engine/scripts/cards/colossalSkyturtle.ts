// `Colossal Skyturtle` - an activation vocab, an activation bounceTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COLOSSAL_SKYTURTLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COLOSSAL_SKYTURTLE, "Flying, ward {2}\nChannel — {2}{G}, Discard this card: Return target card from your graveyard to your hand.\nChannel — {1}{U}, Discard this card: Return target creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Return target card from your graveyard to your hand.", COLOSSAL_SKYTURTLE.name);
const VOCAB_T_A0 = vocabularyTargets("Return target card from your graveyard to your hand.");

export const COLOSSAL_SKYTURTLE_SCRIPT: CardScript = {
  oracleId: COLOSSAL_SKYTURTLE.oracleId,
  name: COLOSSAL_SKYTURTLE.name,
  activated: [
    {
      ref: `${COLOSSAL_SKYTURTLE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
    {
      ref: `${COLOSSAL_SKYTURTLE.oracleId}#a1`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'hand', player: card.owner } }] }];
      },
    },
  ],
};
