// `Cavern Harpy` - a etb trigger vocab, an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAVERN_HARPY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAVERN_HARPY, "Flying\nWhen this creature enters, return a blue or black creature you control to its owner's hand.\nPay 1 life: Return this creature to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Return a blue or black creature you control to its owner's hand.", CAVERN_HARPY.name);
const VOCAB_T_L1 = vocabularyTargets("Return a blue or black creature you control to its owner's hand.");

export const CAVERN_HARPY_SCRIPT: CardScript = {
  oracleId: CAVERN_HARPY.oracleId,
  name: CAVERN_HARPY.name,
  activated: [
    {
      ref: `${CAVERN_HARPY.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Cavern Harpy - Return a blue or black creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
