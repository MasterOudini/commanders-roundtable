// `Agent of the Iron Throne` - a static anthem, a cardPutIntoGraveyard trigger loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AGENT_OF_THE_IRON_THRONE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { grantedTriggerRef } from '../grants';
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

const PRINTED = printed(AGENT_OF_THE_IRON_THRONE, "Commander creatures you own have \"Whenever an artifact or creature you control is put into a graveyard from the battlefield, each opponent loses 1 life.\"");

const GRANT_0 = grantedTriggerRef(`${AGENT_OF_THE_IRON_THRONE.oracleId}#gt0`, AGENT_OF_THE_IRON_THRONE.name);

export const AGENT_OF_THE_IRON_THRONE_SCRIPT: CardScript = {
  oracleId: AGENT_OF_THE_IRON_THRONE.oracleId,
  name: AGENT_OF_THE_IRON_THRONE.name,
  triggers: [
    {
      abilityId: 'gt0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'graveyard' && m.from.kind === 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Artifact') || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Agent of the Iron Throne - loseLifeOpponents",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-grant-0',
      text: PRINTED,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && (ctx.state.players[ctx.query.controllerOf(self) ?? '']?.commanderIds ?? []).includes(candidate),
      modify: (chars, _ctx, self) => {
        chars.grantedTriggered.push({ provider: self, ref: GRANT_0 });
      },
    },
  ],
};
