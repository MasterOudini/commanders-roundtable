// `Isolation Cell` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ISOLATION_CELL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ISOLATION_CELL, "Whenever an opponent casts a creature spell, that player loses 2 life unless they pay {2}.");

const VOCAB_L0 = vocabularyEffects("Target player loses 2 life unless target player pays {2}.", ISOLATION_CELL.name);
const VOCAB_T_L0 = vocabularyTargets("Target player loses 2 life unless target player pays {2}.");

export const ISOLATION_CELL_SCRIPT: CardScript = {
  oracleId: ISOLATION_CELL.oracleId,
  name: ISOLATION_CELL.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, _self, ev) => (ev.t === 'SpellCast' ? ev.obj.controller : null),
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Isolation Cell - Target player loses 2 life unless target player pays {2}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
