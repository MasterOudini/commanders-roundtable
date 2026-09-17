// `Captain Storm, Cosmium Raider` - a artifactEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPTAIN_STORM_COSMIUM_RAIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAPTAIN_STORM_COSMIUM_RAIDER, "Whenever an artifact you control enters, put a +1/+1 counter on target Pirate you control.");

const VOCAB_L0 = vocabularyEffects("Put a +1/+1 counter on target Pirate you control.", CAPTAIN_STORM_COSMIUM_RAIDER.name);
const VOCAB_T_L0 = vocabularyTargets("Put a +1/+1 counter on target Pirate you control.");

export const CAPTAIN_STORM_COSMIUM_RAIDER_SCRIPT: CardScript = {
  oracleId: CAPTAIN_STORM_COSMIUM_RAIDER.oracleId,
  name: CAPTAIN_STORM_COSMIUM_RAIDER.name,
  triggers: [
    {
      abilityId: 'artifactEnters-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact'),
        ),
      label: () => "Captain Storm, Cosmium Raider - Put a +1/+1 counter on target Pirate you control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
