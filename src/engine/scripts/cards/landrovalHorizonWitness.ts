// `Landroval, Horizon Witness` — Flying is the engine's. Whenever two or
// more creatures I control attack a PLAYER, an ATTACKING ground creature
// gains flying until end of turn. The count condition is read off the
// declaration: my attackers whose defender is a player, at least two.
// (Roc Charger's trigger with a different `matches`; D291 + D289.)

import { LANDROVAL_HORIZON_WITNESS } from '../../../data/fixtures/engineCards';
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
  LANDROVAL_HORIZON_WITNESS,
  'Flying\nWhenever two or more creatures you control attack a player, target attacking creature without flying gains flying until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const LANDROVAL_HORIZON_WITNESS_SCRIPT: CardScript = {
  oracleId: LANDROVAL_HORIZON_WITNESS.oracleId,
  name: LANDROVAL_HORIZON_WITNESS.name,
  triggers: [
    {
      abilityId: 'attacks',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        const mine = ctx.query.controllerOf(self);
        // "attack a player": two or more of mine attacking the SAME player.
        const perPlayer = new Map<string, number>();
        for (const a of ev.attackers) {
          if (ctx.state.cards[a.card]?.controller !== mine) continue;
          if (a.defender.kind !== 'player') continue;
          perPlayer.set(a.defender.id, (perPlayer.get(a.defender.id) ?? 0) + 1);
        }
        return [...perPlayer.values()].some((n) => n >= 2);
      },
      label: () => 'Landroval, Horizon Witness — target attacking creature without flying gains flying until end of turn',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['flying'] }];
      },
    },
  ],
};
