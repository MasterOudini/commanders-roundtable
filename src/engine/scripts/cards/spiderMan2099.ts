// `Spider-Man 2099, Miguel O'Hara` - "When Spider-Man 2099 enters, return up to
// one target creature to its owner's hand" (D299's count) and "Whenever one or
// more creatures you control deal combat damage to a player, draw a card" - one
// batched combat-damage event, so one firing per damage step (not per creature).

import { SPIDER_MAN_2099_MIGUEL_O_HARA } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(
  SPIDER_MAN_2099_MIGUEL_O_HARA,
  "When Spider-Man 2099 enters, return up to one target creature to its owner's hand.\nWhenever one or more creatures you control deal combat damage to a player, draw a card.",
);
const LINES = PRINTED.split('\n');
const ENTERS = LINES[0] as string;

export const SPIDER_MAN2099_SCRIPT: CardScript = {
  oracleId: SPIDER_MAN_2099_MIGUEL_O_HARA.oracleId,
  name: SPIDER_MAN_2099_MIGUEL_O_HARA.name,
  triggers: [
    {
      abilityId: 'etb',
      text: ENTERS,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(ENTERS),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Spider-Man 2099 - return up to one target creature to its owner's hand",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick ("up to one" may be declared with none).
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          out.push({ t: 'CardsMoved', moves: [{ card: target.id, from: { kind: 'battlefield', player: card.controller }, to: { kind: 'hand', player: card.owner } }] });
        }
        return out;
      },
    },
    {
      abilityId: 'combat-damage-by-your-creatures',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      // "One or more": the combat damage step is ONE event, so this fires once
      // however many of the controller's creatures connected.
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some(
          (d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self),
        ),
      label: () => 'Spider-Man 2099 - draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
