// `Pilgrim of the Ages` - a etb trigger vocab, an activation returnSelfToHand
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PILGRIM_OF_THE_AGES } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PILGRIM_OF_THE_AGES, "When this creature enters, you may search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.\n{6}: Return this card from your graveyard to your hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.", PILGRIM_OF_THE_AGES.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.");

export const PILGRIM_OF_THE_AGES_SCRIPT: CardScript = {
  oracleId: PILGRIM_OF_THE_AGES.oracleId,
  name: PILGRIM_OF_THE_AGES.name,
  activated: [
    {
      ref: `${PILGRIM_OF_THE_AGES.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'graveyard') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'graveyard', player: me.owner }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Pilgrim of the Ages - Search your library for a basic Plains card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
