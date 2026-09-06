// `Stone-Seeder Hierophant` - a landfall trigger untapSelf, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STONE_SEEDER_HIEROPHANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STONE_SEEDER_HIEROPHANT, "Landfall — Whenever a land you control enters, untap this creature.\n{T}: Untap target land.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Untap target land.", STONE_SEEDER_HIEROPHANT.name);
const VOCAB_T_A0 = vocabularyTargets("Untap target land.");

export const STONE_SEEDER_HIEROPHANT_SCRIPT: CardScript = {
  oracleId: STONE_SEEDER_HIEROPHANT.oracleId,
  name: STONE_SEEDER_HIEROPHANT.name,
  activated: [
    {
      ref: `${STONE_SEEDER_HIEROPHANT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'landfall-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Stone-Seeder Hierophant - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
