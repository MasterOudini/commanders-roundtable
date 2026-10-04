// `Ishi-Ishi, Akki Crackshot` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ISHI_ISHI_AKKI_CRACKSHOT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ISHI_ISHI_AKKI_CRACKSHOT, "Whenever an opponent casts a Spirit or Arcane spell, Ishi-Ishi deals 2 damage to that player.");

const VOCAB_L0 = vocabularyEffects("~ deals 2 damage to target player.", ISHI_ISHI_AKKI_CRACKSHOT.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 2 damage to target player.");

export const ISHI_ISHI_AKKI_CRACKSHOT_SCRIPT: CardScript = {
  oracleId: ISHI_ISHI_AKKI_CRACKSHOT.oracleId,
  name: ISHI_ISHI_AKKI_CRACKSHOT.name,
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
        (ctx.derive(ev.obj.card).typeLine.subtypes.includes('Spirit') || ctx.derive(ev.obj.card).typeLine.subtypes.includes('Arcane')),
      label: () => "Ishi-Ishi, Akki Crackshot - ~ deals 2 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
