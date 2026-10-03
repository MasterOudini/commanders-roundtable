// `Vogar, Necropolis Tyrant` - a anyOtherCreatureDies trigger selfCounter, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VOGAR_NECROPOLIS_TYRANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VOGAR_NECROPOLIS_TYRANT, "Menace\nWhenever another creature dies during your turn, put a +1/+1 counter on Vogar.\nWhen Vogar dies, draw a card for each +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw a card for each +1/+1 counter on ~.", VOGAR_NECROPOLIS_TYRANT.name);
const VOCAB_T_L2 = vocabularyTargets("Draw a card for each +1/+1 counter on ~.");

export const VOGAR_NECROPOLIS_TYRANT_SCRIPT: CardScript = {
  oracleId: VOGAR_NECROPOLIS_TYRANT.oracleId,
  name: VOGAR_NECROPOLIS_TYRANT.name,
  triggers: [
    {
      abilityId: 'anyOtherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature'))),
      label: () => "Vogar, Necropolis Tyrant - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
    {
      abilityId: 'dies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Vogar, Necropolis Tyrant - Draw a card for each +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
