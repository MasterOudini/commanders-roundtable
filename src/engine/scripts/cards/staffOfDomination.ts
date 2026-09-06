// `Staff of Domination` - an activation untapSelf, an activation gainLife, an activation vocab, an activation tapTarget, an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STAFF_OF_DOMINATION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(STAFF_OF_DOMINATION, "{1}: Untap this artifact.\n{2}, {T}: You gain 1 life.\n{3}, {T}: Untap target creature.\n{4}, {T}: Tap target creature.\n{5}, {T}: Draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A2 = vocabularyEffects("Untap target creature.", STAFF_OF_DOMINATION.name);
const VOCAB_T_A2 = vocabularyTargets("Untap target creature.");

export const STAFF_OF_DOMINATION_SCRIPT: CardScript = {
  oracleId: STAFF_OF_DOMINATION.oracleId,
  name: STAFF_OF_DOMINATION.name,
  activated: [
    {
      ref: `${STAFF_OF_DOMINATION.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
    {
      ref: `${STAFF_OF_DOMINATION.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
    {
      ref: `${STAFF_OF_DOMINATION.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A2, VOCAB_T_A2);
      },
    },
    {
      ref: `${STAFF_OF_DOMINATION.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
    {
      ref: `${STAFF_OF_DOMINATION.oracleId}#a4`,
      text: LINES[4] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
