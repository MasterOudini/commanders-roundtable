// `Flight Spellbomb` - an activation pumpTarget, a auraToGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FLIGHT_SPELLBOMB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FLIGHT_SPELLBOMB, "{T}, Sacrifice this artifact: Target creature gains flying until end of turn.\nWhen this artifact is put into a graveyard from the battlefield, you may pay {U}. If you do, draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may pay {U}. If you do, draw a card.", FLIGHT_SPELLBOMB.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {U}. If you do, draw a card.");

export const FLIGHT_SPELLBOMB_SCRIPT: CardScript = {
  oracleId: FLIGHT_SPELLBOMB.oracleId,
  name: FLIGHT_SPELLBOMB.name,
  activated: [
    {
      ref: `${FLIGHT_SPELLBOMB.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ["flying"] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Flight Spellbomb - You may pay {U}. If you do, draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
