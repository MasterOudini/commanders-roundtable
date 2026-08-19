// `Mavren Fein, Dusk Apostle` — "Whenever one or more nontoken Vampires you
// control attack, create a 1/1 white Vampire creature token with lifelink."
// Jedit's attack arm with the filter on the ATTACKERS: nontoken (the instance
// fact), Vampire (derived subtypes), mine — and the printed "one or more" IS
// the per-declaration batch, Deeproot's argument. M6.4ad, D186.

import { MAVREN_FEIN_DUSK_APOSTLE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
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

const TEXT = printed(
  MAVREN_FEIN_DUSK_APOSTLE,
  'Whenever one or more nontoken Vampires you control attack, create a 1/1 white Vampire creature token with lifelink.',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const VAMPIRE = tokenRef('Vampire|1/1|W|Creature|lifelink');

export const MAVREN_FEIN_DUSK_APOSTLE_SCRIPT: CardScript = {
  oracleId: MAVREN_FEIN_DUSK_APOSTLE.oracleId,
  name: MAVREN_FEIN_DUSK_APOSTLE.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.some((a) => {
          const inst = ctx.state.cards[a.card];
          if (!inst || inst.isToken) return false;
          if (ctx.query.controllerOf(a.card) !== ctx.query.controllerOf(self)) return false;
          return ctx.derive(a.card).typeLine.subtypes.includes('Vampire');
        }),
      label: () => 'Mavren Fein — create a 1/1 Vampire with lifelink',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: VAMPIRE.oracleId,
          printingId: VAMPIRE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
