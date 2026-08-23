// `Vial Smasher, Gleeful Grenadier` — the OUTLAW entry watcher. "Outlaw" is a
// SET of five creature subtypes (Assassin, Mercenary, Pirate, Rogue, Warlock),
// spelled out in the card's own reminder text, and read off the derived
// subtypes.
//
// ⚠️ TWO defs for one printed line: a token enters via `TokenCreated` and a
// card via `CardsMoved`, and the bus dispatches on exact event kind (D158).
// "ANOTHER outlaw" excludes the Smasher's own entry, which is why the
// CardsMoved arm carries an is-it-me check where D265's Veil of Assimilation
// deliberately does not. D266.

import { VIAL_SMASHER_GLEEFUL_GRENADIER } from '../../../data/fixtures/engineCards';
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
  VIAL_SMASHER_GLEEFUL_GRENADIER,
  'Whenever another outlaw you control enters, Vial Smasher deals 1 damage to target opponent. (Assassins, Mercenaries, Pirates, Rogues, and Warlocks are outlaws.)',
);

/** CR 702.x has no "outlaw" keyword — the card's own reminder text lists it. */
const OUTLAW = ['Assassin', 'Mercenary', 'Pirate', 'Rogue', 'Warlock'];

const SPECS = parseTargetClauses(TEXT);

export const VIAL_SMASHER_GLEEFUL_GRENADIER_SCRIPT: CardScript = {
  oracleId: VIAL_SMASHER_GLEEFUL_GRENADIER.oracleId,
  name: VIAL_SMASHER_GLEEFUL_GRENADIER.name,
  triggers: [
    {
      abilityId: 'outlaw-card-enters',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: SPECS,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'CardsMoved') return false;
        const mine = ctx.query.controllerOf(self);
        return ev.moves.some((m) => {
          if (m.card === self) return false; // "another"
          if (m.to.kind !== 'battlefield' || m.from.kind === 'battlefield') return false;
          if (m.to.player !== mine) return false;
          const subs = ctx.derive(m.card).typeLine.subtypes;
          return OUTLAW.some((s) => subs.includes(s));
        });
      },
      label: () => 'Vial Smasher — deal 1 damage to target opponent',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const hit = ctx.state.players[target.id];
        if (!hit || hit.hasLost) return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'player', id: target.id },
                amount: 1,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
    {
      abilityId: 'outlaw-token-enters',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: SPECS,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'TokenCreated') return false;
        if (ev.controller !== ctx.query.controllerOf(self)) return false;
        const subs = ctx.derive(ev.card).typeLine.subtypes;
        return OUTLAW.some((s) => subs.includes(s));
      },
      label: () => 'Vial Smasher — deal 1 damage to target opponent',
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'player') return [];
        const hit = ctx.state.players[target.id];
        if (!hit || hit.hasLost) return [];
        return [
          {
            t: 'DamageDealt',
            damages: [
              {
                source: self,
                target: { kind: 'player', id: target.id },
                amount: 1,
                deathtouch: false,
                lifelinkTo: null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          },
        ];
      },
    },
  ],
};
