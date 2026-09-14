// `Dingus Staff` - a aCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DINGUS_STAFF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DINGUS_STAFF, "Whenever a creature dies, this artifact deals 2 damage to that creature's controller.");

const VOCAB_L0 = vocabularyEffects("This artifact deals 2 damage to target player.", DINGUS_STAFF.name);
const VOCAB_T_L0 = vocabularyTargets("This artifact deals 2 damage to target player.");

export const DINGUS_STAFF_SCRIPT: CardScript = {
  oracleId: DINGUS_STAFF.oracleId,
  name: DINGUS_STAFF.name,
  triggers: [
    {
      abilityId: 'aCreatureDies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      perItem: (ctx, _self, ev) => (ev.t === 'CardsMoved' ? ev.moves.filter((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')).map((m) => m.card) : []),
      playerOf: (ctx, _self, _ev, item) => (item !== undefined ? (ctx.state.cards[item]?.controller ?? null) : null),
      matches: (ctx, _self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.derive(m.card).typeLine.types.includes('Creature')),
      label: () => "Dingus Staff - This artifact deals 2 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
