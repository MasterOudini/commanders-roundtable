// `Magma Phoenix` - a dies trigger vocab, an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAGMA_PHOENIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAGMA_PHOENIX, "Flying\nWhen this creature dies, it deals 3 damage to each creature and each player.\n{3}{R}{R}: Return this card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ deals 3 damage to each creature and each player.", MAGMA_PHOENIX.name);
const VOCAB_T_L1 = vocabularyTargets("~ deals 3 damage to each creature and each player.");

export const MAGMA_PHOENIX_SCRIPT: CardScript = {
  oracleId: MAGMA_PHOENIX.oracleId,
  name: MAGMA_PHOENIX.name,
  activated: [
    {
      ref: `${MAGMA_PHOENIX.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Magma Phoenix - ~ deals 3 damage to each creature and each player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
