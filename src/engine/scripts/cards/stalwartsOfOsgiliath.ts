// `Stalwarts of Osgiliath` - a etb trigger vocab, a secondCard trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STALWARTS_OF_OSGILIATH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STALWARTS_OF_OSGILIATH, "When this creature enters, the Ring tempts you.\nWhenever you draw your second card each turn, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("The Ring tempts you.", STALWARTS_OF_OSGILIATH.name);
const VOCAB_T_L0 = vocabularyTargets("The Ring tempts you.");

export const STALWARTS_OF_OSGILIATH_SCRIPT: CardScript = {
  oracleId: STALWARTS_OF_OSGILIATH.oracleId,
  name: STALWARTS_OF_OSGILIATH.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Stalwarts of Osgiliath - The Ring tempts you.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'secondCard-1',
      text: LINES[1] as string,
      event: 'DrewCards',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'DrewCards' && ev.player === ctx.query.controllerOf(self) && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) >= 2 && (ctx.state.turn.cardsDrawn[ev.player] ?? 0) - ev.cards.length < 2,
      label: () => "Stalwarts of Osgiliath - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
