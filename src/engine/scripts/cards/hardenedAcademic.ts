// `Hardened Academic` - an activation pumping itself, a cardLeavesYourGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARDENED_ACADEMIC } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARDENED_ACADEMIC, "Flying, haste\nDiscard a card: This creature gains lifelink until end of turn.\nWhenever one or more cards leave your graveyard, put a +1/+1 counter on target creature you control.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Put a +1/+1 counter on target creature you control.", HARDENED_ACADEMIC.name);
const VOCAB_T_L2 = vocabularyTargets("Put a +1/+1 counter on target creature you control.");

export const HARDENED_ACADEMIC_SCRIPT: CardScript = {
  oracleId: HARDENED_ACADEMIC.oracleId,
  name: HARDENED_ACADEMIC.name,
  activated: [
    {
      ref: `${HARDENED_ACADEMIC.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["lifelink"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'graveyard' && m.from.player === ctx.query.controllerOf(self)),
      label: () => "Hardened Academic - Put a +1/+1 counter on target creature you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
