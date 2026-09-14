// `Lava Zombie` - a etb trigger vocab, an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LAVA_ZOMBIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LAVA_ZOMBIE, "When this creature enters, return a black or red creature you control to its owner's hand.\n{2}: This creature gets +1/+0 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Return a black or red creature you control to its owner's hand.", LAVA_ZOMBIE.name);
const VOCAB_T_L0 = vocabularyTargets("Return a black or red creature you control to its owner's hand.");

export const LAVA_ZOMBIE_SCRIPT: CardScript = {
  oracleId: LAVA_ZOMBIE.oracleId,
  name: LAVA_ZOMBIE.name,
  activated: [
    {
      ref: `${LAVA_ZOMBIE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Lava Zombie - Return a black or red creature you control to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
