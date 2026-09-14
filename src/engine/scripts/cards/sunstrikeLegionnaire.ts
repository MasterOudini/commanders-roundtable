// `Sunstrike Legionnaire` - a static noUntap, a anotherCreatureEnters trigger untapSelf, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SUNSTRIKE_LEGIONNAIRE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SUNSTRIKE_LEGIONNAIRE, "This creature doesn't untap during your untap step.\nWhenever another creature enters, untap this creature.\n{T}: Tap target creature with mana value 3 or less.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("Tap target creature with mana value 3 or less.", SUNSTRIKE_LEGIONNAIRE.name);
const VOCAB_T_A0 = vocabularyTargets("Tap target creature with mana value 3 or less.");

export const SUNSTRIKE_LEGIONNAIRE_SCRIPT: CardScript = {
  oracleId: SUNSTRIKE_LEGIONNAIRE.oracleId,
  name: SUNSTRIKE_LEGIONNAIRE.name,
  activated: [
    {
      ref: `${SUNSTRIKE_LEGIONNAIRE.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Sunstrike Legionnaire - untapSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
  replacements: [
    {
      abilityId: 'no-untap-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.1 - the untap step's untap is replaced for this one permanent (D371).
      applies: (ctx, self, ev) =>
        ev.t === 'PermanentsUntapped' && ctx.state.turn.step === 'untap' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self) && ev.cards.includes(self),
      replace: (_ctx, self, ev): readonly EventBody[] => {
        if (ev.t !== 'PermanentsUntapped') return [ev];
        const cards = ev.cards.filter((c) => c !== self);
        return cards.length ? [{ t: 'PermanentsUntapped', cards }] : [];
      },
    },
  ],
};
