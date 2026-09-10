// `Sephiroth, Planet's Heir` - a etb trigger vocab, a aCreatureDies trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SEPHIROTH_PLANET_S_HEIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SEPHIROTH_PLANET_S_HEIR, "Vigilance (Attacking doesn't cause this creature to tap.)\nWhen Sephiroth enters, creatures your opponents control get -2/-2 until end of turn.\nWhenever a creature an opponent controls dies, put a +1/+1 counter on Sephiroth.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Creatures your opponents control get -2/-2 until end of turn.", SEPHIROTH_PLANET_S_HEIR.name);
const VOCAB_T_L1 = vocabularyTargets("Creatures your opponents control get -2/-2 until end of turn.");

export const SEPHIROTH_PLANETS_HEIR_SCRIPT: CardScript = {
  oracleId: SEPHIROTH_PLANET_S_HEIR.oracleId,
  name: SEPHIROTH_PLANET_S_HEIR.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Sephiroth, Planet's Heir - Creatures your opponents control get -2/-2 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'aCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller !== ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Sephiroth, Planet's Heir - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
