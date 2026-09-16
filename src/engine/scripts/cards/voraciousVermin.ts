// `Voracious Vermin` - a etb trigger vocab, a anotherCreatureDies trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VORACIOUS_VERMIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VORACIOUS_VERMIN, "When this creature enters, create a 1/1 black Rat creature token with \"This token can't block.\"\nWhenever another creature you control dies, put a +1/+1 counter on this creature.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Create a 1/1 black Rat creature token with \"This token can't block.\"", VORACIOUS_VERMIN.name);
const VOCAB_T_L0 = vocabularyTargets("Create a 1/1 black Rat creature token with \"This token can't block.\"");

export const VORACIOUS_VERMIN_SCRIPT: CardScript = {
  oracleId: VORACIOUS_VERMIN.oracleId,
  name: VORACIOUS_VERMIN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Voracious Vermin - Create a 1/1 black Rat creature token with \"This token can't block.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'anotherCreatureDies-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Voracious Vermin - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
