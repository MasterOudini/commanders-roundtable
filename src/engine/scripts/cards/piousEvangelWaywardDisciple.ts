// `Pious Evangel // Wayward Disciple` - a selfOrAnotherCreatureEnters trigger gainLife, an activation vocab, a dies trigger vocab, a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PIOUS_EVANGEL_WAYWARD_DISCIPLE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(PIOUS_EVANGEL_WAYWARD_DISCIPLE, "Whenever this creature or another creature you control enters, you gain 1 life.\n{2}, {T}, Sacrifice another permanent: Transform this creature.\nWhenever this creature or another creature you control dies, target opponent loses 1 life and you gain 1 life.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = transformFrom(vocabularyEffects("Transform this creature.", PIOUS_EVANGEL_WAYWARD_DISCIPLE.name), 0);
const VOCAB_T_A0 = vocabularyTargets("Transform this creature.");
const VOCAB_L2 = vocabularyEffects("Target opponent loses 1 life and you gain 1 life.", PIOUS_EVANGEL_WAYWARD_DISCIPLE.name);
const VOCAB_T_L2 = vocabularyTargets("Target opponent loses 1 life and you gain 1 life.");

export const PIOUS_EVANGEL_WAYWARD_DISCIPLE_SCRIPT: CardScript = {
  oracleId: PIOUS_EVANGEL_WAYWARD_DISCIPLE.oracleId,
  name: PIOUS_EVANGEL_WAYWARD_DISCIPLE.name,
  activated: [
    {
      ref: `${PIOUS_EVANGEL_WAYWARD_DISCIPLE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'selfOrAnotherCreatureEnters-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Pious Evangel // Wayward Disciple - gain life",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const me = ctx.state.players[obj.controller];
        if (!me) return [];
        return [{ t: 'LifeChanged', player: obj.controller, delta: 1, to: me.life + 1 }];
      },
    },
    {
      abilityId: 'dies-2', face: 1,
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Pious Evangel // Wayward Disciple - Target opponent loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
    {
      abilityId: 'anotherCreatureDies-2', face: 1,
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Pious Evangel // Wayward Disciple - Target opponent loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
