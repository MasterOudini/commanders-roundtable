// `Capricious Sliver` - a static anthem, a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAPRICIOUS_SLIVER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(CAPRICIOUS_SLIVER, "Sliver creatures you control have \"Whenever this creature deals combat damage to a player, exile the top card of your library. You may play that card this turn.\"");

const VOCAB_L0 = vocabularyEffects("Exile the top card of your library. You may play that card this turn.", CAPRICIOUS_SLIVER.name);
const VOCAB_T_L0 = vocabularyTargets("Exile the top card of your library. You may play that card this turn.");

const GRANT_0 = grantedTriggerRef(`${CAPRICIOUS_SLIVER.oracleId}#gt0`, CAPRICIOUS_SLIVER.name);

export const CAPRICIOUS_SLIVER_SCRIPT: CardScript = {
  oracleId: CAPRICIOUS_SLIVER.oracleId,
  name: CAPRICIOUS_SLIVER.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Capricious Sliver - Exile the top card of your library. You may play that card this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes("Sliver") && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
