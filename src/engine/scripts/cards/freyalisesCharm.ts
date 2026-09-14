// `Freyalise's Charm` - a opponentCastsSpell trigger vocab, an activation bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FREYALISE_S_CHARM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FREYALISE_S_CHARM, "Whenever an opponent casts a black spell, you may pay {G}{G}. If you do, you draw a card.\n{G}{G}: Return this enchantment to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You may pay {G}{G}. If you do, you draw a card.", FREYALISE_S_CHARM.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {G}{G}. If you do, you draw a card.");

export const FREYALISES_CHARM_SCRIPT: CardScript = {
  oracleId: FREYALISE_S_CHARM.oracleId,
  name: FREYALISE_S_CHARM.name,
  activated: [
    {
      ref: `${FREYALISE_S_CHARM.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'opponentCastsSpell-0',
      text: LINES[0] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).colors.includes('B'),
      label: () => "Freyalise's Charm - You may pay {G}{G}. If you do, you draw a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
