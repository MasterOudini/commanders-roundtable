// `Proper Burial` - a creatureYouControlDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROPER_BURIAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROPER_BURIAL, "Whenever a creature you control dies, you gain life equal to that creature's toughness.");

const VOCAB_L0 = vocabularyEffects("You gain life equal to target creature's toughness.", PROPER_BURIAL.name);
const VOCAB_T_L0 = vocabularyTargets("You gain life equal to target creature's toughness.");

export const PROPER_BURIAL_SCRIPT: CardScript = {
  oracleId: PROPER_BURIAL.oracleId,
  name: PROPER_BURIAL.name,
  triggers: [
    {
      abilityId: 'creatureYouControlDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      memo: (ctx, _self, _ev, item) => (item !== undefined ? (ctx.derive(item).toughness ?? 0) : 0),
      optional: false,
      looksBack: true,
      perItem: (ctx, self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Proper Burial - You gain life equal to target creature's toughness.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0, true);
      },
    },
  ],
};
