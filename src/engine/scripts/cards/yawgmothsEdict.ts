// `Yawgmoth's Edict` - a opponentCastsSpell trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { YAWGMOTH_S_EDICT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(YAWGMOTH_S_EDICT, "Whenever an opponent casts a white spell, that player loses 1 life and you gain 1 life.");

const VOCAB_L0 = vocabularyEffects("Target player loses 1 life and you gain 1 life.", YAWGMOTH_S_EDICT.name);
const VOCAB_T_L0 = vocabularyTargets("Target player loses 1 life and you gain 1 life.");

export const YAWGMOTHS_EDICT_SCRIPT: CardScript = {
  oracleId: YAWGMOTH_S_EDICT.oracleId,
  name: YAWGMOTH_S_EDICT.name,
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
        ctx.derive(ev.obj.card).colors.includes('W'),
      label: () => "Yawgmoth's Edict - Target player loses 1 life and you gain 1 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.player === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'player', id: obj.player }] }, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
