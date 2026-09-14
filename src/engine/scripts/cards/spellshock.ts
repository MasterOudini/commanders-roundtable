// `Spellshock` - a aPlayerCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SPELLSHOCK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SPELLSHOCK, "Whenever a player casts a spell, this enchantment deals 2 damage to that player.");

const VOCAB_L0 = vocabularyEffects("This enchantment deals 2 damage to target player.", SPELLSHOCK.name);
const VOCAB_T_L0 = vocabularyTargets("This enchantment deals 2 damage to target player.");

export const SPELLSHOCK_SCRIPT: CardScript = {
  oracleId: SPELLSHOCK.oracleId,
  name: SPELLSHOCK.name,
  triggers: [
    {
      abilityId: 'aPlayerCastsSpell-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      playerOf: (_ctx, _self, ev) => (ev.t === 'SpellCast' ? ev.obj.controller : null),
      matches: (_ctx, _self, ev) => ev.t === 'SpellCast',
      label: () => "Spellshock - This enchantment deals 2 damage to target player.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
