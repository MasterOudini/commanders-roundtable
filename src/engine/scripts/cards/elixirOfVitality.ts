// `Elixir of Vitality` — "This artifact enters tapped.\n{T}, Sacrifice this
// artifact: You gain 4 life.\n{8}, {T}, Sacrifice this artifact: You gain 8
// life." The enters-tapped line is the engine's (D134's funnel); the two
// self-sacrifice activations are the def's, each charged at activation
// (D159) and reading `obj.controller`. D275.

import { ELIXIR_OF_VITALITY } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
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

const PRINTED = printed(
  ELIXIR_OF_VITALITY,
  'This artifact enters tapped.\n{T}, Sacrifice this artifact: You gain 4 life.\n{8}, {T}, Sacrifice this artifact: You gain 8 life.',
);
const FOUR = PRINTED.split('\n')[1] as string;
const EIGHT = PRINTED.split('\n')[2] as string;

function gain(ctx: ScriptCtx, controller: string, amount: number): readonly EventBody[] {
  const me = ctx.state.players[controller];
  if (!me || me.hasLost) return [];
  return [{ t: 'LifeChanged', player: controller, delta: amount, to: me.life + amount }];
}

export const ELIXIR_OF_VITALITY_SCRIPT: CardScript = {
  oracleId: ELIXIR_OF_VITALITY.oracleId,
  name: ELIXIR_OF_VITALITY.name,
  activated: [
    {
      ref: `${ELIXIR_OF_VITALITY.oracleId}#a0`,
      text: FOUR,
      resolve: (ctx, _self, obj): readonly EventBody[] => gain(ctx, obj.controller, 4),
    },
    {
      ref: `${ELIXIR_OF_VITALITY.oracleId}#a1`,
      text: EIGHT,
      resolve: (ctx, _self, obj): readonly EventBody[] => gain(ctx, obj.controller, 8),
    },
  ],
};
