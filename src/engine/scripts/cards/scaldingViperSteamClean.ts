// `Scalding Viper // Steam Clean` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SCALDING_VIPER_STEAM_CLEAN } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(SCALDING_VIPER_STEAM_CLEAN, "Whenever an opponent casts a spell with mana value 3 or less, this creature deals 1 damage to that player.\nReturn target nonland permanent to its owner's hand. (Then exile this card. You may cast the creature later from exile.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ deals 1 damage to target player.", SCALDING_VIPER_STEAM_CLEAN.name);
const VOCAB_T_L0 = vocabularyTargets("~ deals 1 damage to target player.");

export const SCALDING_VIPER_STEAM_CLEAN_SCRIPT: CardScript = {
  oracleId: SCALDING_VIPER_STEAM_CLEAN.oracleId,
  name: SCALDING_VIPER_STEAM_CLEAN.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0', face: 0,
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, _self, ev) => (ev.t === 'SpellCast' ? ev.obj.controller : null),
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        (ctx.derive(ev.obj.card).manaValue ?? 0) <= 3,
      label: () => "Scalding Viper // Steam Clean - ~ deals 1 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: VOCAB_T_L0.map(() => ({ kind: 'player' as const, id: obj.player as string })) }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
