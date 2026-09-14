// `Bereavement` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BEREAVEMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BEREAVEMENT, "Whenever a green creature dies, its controller discards a card.");

const VOCAB_L0 = vocabularyEffects("Target player discards a card.", BEREAVEMENT.name);
const VOCAB_T_L0 = vocabularyTargets("Target player discards a card.");

export const BEREAVEMENT_SCRIPT: CardScript = {
  oracleId: BEREAVEMENT.oracleId,
  name: BEREAVEMENT.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      perItem: (ctx, self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      playerOf: (ctx, _self, _ev, item) => (item !== undefined ? (ctx.state.cards[item]?.controller ?? null) : null),
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature') && ctx.derive(m.card).colors.includes('G'),
        ),
      label: () => "Bereavement - Target player discards a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
