// `Aya of Alexandria` - a creatureCombatDamagePlayer trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AYA_OF_ALEXANDRIA } from '../../../data/fixtures/engineCards';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(AYA_OF_ALEXANDRIA, "Menace, lifelink\nWhenever a historic creature you control deals combat damage to a player, create a 1/1 black Assassin creature token with menace. (Artifacts, legendaries, and Sagas are historic.)");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Assassin|1/1|B|Creature|menace");

export const AYA_OF_ALEXANDRIA_SCRIPT: CardScript = {
  oracleId: AYA_OF_ALEXANDRIA.oracleId,
  name: AYA_OF_ALEXANDRIA.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && (ctx.derive(d.source).typeLine.types.includes('Artifact') || ctx.derive(d.source).typeLine.supertypes.includes('Legendary') || ctx.derive(d.source).typeLine.subtypes.includes('Saga'))).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && (ctx.derive(d.source).typeLine.types.includes('Artifact') || ctx.derive(d.source).typeLine.supertypes.includes('Legendary') || ctx.derive(d.source).typeLine.subtypes.includes('Saga'))),
      label: () => "Aya of Alexandria - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
