// `Imperial Subduer` — "Whenever a Samurai or Warrior you control attacks
// alone, tap target creature you don't control." The first ATTACKS-ALONE
// filter: exactly ONE declared attacker (CR 506.5), and that one a
// controlled Samurai-or-Warrior — the Subduer itself is a Samurai, so its
// own lone attack qualifies. M6.4x, D180.

import { IMPERIAL_SUBDUER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  IMPERIAL_SUBDUER,
  "Whenever a Samurai or Warrior you control attacks alone, tap target creature you don't control.",
);

export const IMPERIAL_SUBDUER_SCRIPT: CardScript = {
  oracleId: IMPERIAL_SUBDUER.oracleId,
  name: IMPERIAL_SUBDUER.name,
  triggers: [
    {
      abilityId: 'attacks-alone',
      text: TEXT,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => {
        if (ev.t !== 'AttackersDeclared') return false;
        if (ev.attackers.length !== 1) return false;
        const lone = ev.attackers[0];
        if (!lone) return false;
        const inst = ctx.state.cards[lone.card];
        if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
        const subtypes = ctx.derive(lone.card).typeLine.subtypes;
        return subtypes.includes('Samurai') || subtypes.includes('Warrior');
      },
      label: () => "Imperial Subduer — tap target creature you don't control",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
