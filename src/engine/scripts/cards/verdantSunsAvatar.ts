// `Verdant Sun's Avatar` - a selfOrAnotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VERDANT_SUN_S_AVATAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VERDANT_SUN_S_AVATAR, "Whenever this creature or another creature you control enters, you gain life equal to that creature's toughness.");

const VOCAB_L0 = vocabularyEffects("You gain life equal to target creature's toughness.", VERDANT_SUN_S_AVATAR.name);
const VOCAB_T_L0 = vocabularyTargets("You gain life equal to target creature's toughness.");

export const VERDANT_SUNS_AVATAR_SCRIPT: CardScript = {
  oracleId: VERDANT_SUN_S_AVATAR.oracleId,
  name: VERDANT_SUN_S_AVATAR.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherCreatureEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Verdant Sun's Avatar - You gain life equal to target creature's toughness.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
