import type { BuildingType, GodPowerType } from '../../game/types';
import { CompiledSprite } from './pixelEngine';
import {
  RAMPS,
  hash2d,
  paintSprite,
  quantRamp,
} from './pixelPainter';

export const POWER_SPRITES: Record<GodPowerType, CompiledSprite> = {
  // Armored golden telekinetic gauntlet grasping cyan levitation rings & sparkles
  drag_entity: paintSprite((c) => {
    // Cuff & wrist gauntlet
    c.fillCapsule(10, 26, 15, 20, 4.5, 4.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    // Armored palm sphere
    c.fillEllipse(16, 16, 6.0, 5.4, -0.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.04, x, y, 0.02),
    );
    // Thumb & 4 articulated fingers curved upward
    c.fillBezier(10, 17, 6, 15, 7, 10, 1.8, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    for (const [fx, fy, tx, ty] of [
      [11, 13, 10, 6],
      [14, 12, 14, 4],
      [18, 12, 19, 5],
      [21, 14, 24, 8],
    ]) {
      c.fillCapsule(fx, fy, tx, ty, 1.7, 1.3, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.gold, light * 1.05, x, y, 0.02),
      );
    }
    // Glowing cyan telekinetic palm gem & floating sparks
    c.fillEllipse(16, 16, 2.3, 2.3, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.15, x, y, 0.02),
    );
    c.sparkle(7, 6, RAMPS.azure.hi, true);
    c.sparkle(25, 13, RAMPS.azure.hi, false);
    c.sparkle(16, 2, RAMPS.gold.hi, false);
  }),

  // Glossy winged sacred heart under a floating golden halo
  blessing: paintSprite((c) => {
    // Left & right feathered angel wings
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        c.fillBezier(
          16 + dir * 4,
          17 + i * 2,
          16 + dir * 11,
          11 + i * 3,
          16 + dir * 13,
          9 + i * 3.5,
          2.2,
          1.0,
          (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.cloud, light * 1.1, x, y, 0.02),
        );
      }
    }
    // Plump 3D crimson heart lobes & pointed tip
    c.fillEllipse(13, 14, 4.6, 4.6, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.25 && ny < -0.25 && nz > 0.6) return RAMPS.crimson.hi;
      return quantRamp(RAMPS.crimson, light * 1.05, x, y, 0.02);
    });
    c.fillEllipse(19, 14, 4.6, 4.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.crimson, light * 0.96, x, y, 0.02),
    );
    c.fillPoly(
      [
        [9, 16],
        [23, 16],
        [16, 26],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.crimson, light * 0.95, x, y, 0.02),
    );
    // Floating golden halo above
    c.fillEllipse(16, 5.5, 6.5, 2.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.12, x, y, 0.02),
    );
    c.sparkle(11, 12, [255, 250, 240], false);
    c.sparkle(8, 25, RAMPS.gold.hi, false);
    c.sparkle(25, 24, RAMPS.gold.hi, false);
  }),

  // Fluffy cumulus raincloud showering turquoise & emerald raindrops
  rain_of_plenty: paintSprite((c) => {
    // Cloud puffs (spheres blended cleanly)
    c.fillEllipse(10, 12, 5.6, 4.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.04, x, y, 0.02),
    );
    c.fillEllipse(22, 12.5, 5.2, 4.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 0.96, x, y, 0.02),
    );
    c.fillEllipse(16, 9, 6.8, 5.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.1, x, y, 0.02),
    );
    c.fillCapsule(8, 13.5, 24, 13.5, 3.4, 3.2, (x, y, _nx, _ny, _nz, light, _u, v) =>
      quantRamp(RAMPS.cloud, light * (1.0 - v * 0.35), x, y, 0.02),
    );
    // Teardrop rain streaks
    const drops: ReadonlyArray<readonly [number, number, boolean]> = [
      [8, 21, true],
      [14, 23, false],
      [20, 20, true],
      [25, 23, false],
      [11, 27, false],
      [18, 28, true],
    ];
    for (const [dx, dy, isMint] of drops) {
      c.fillCapsule(dx, dy - 1.5, dx - 0.8, dy + 1.5, 0.7, 1.5, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(isMint ? RAMPS.leaf : RAMPS.azure, light * 1.15, x, y, 0.01),
      );
      c.put(dx - 1, dy, [255, 255, 255]);
    }
  }),

  // Radiant filament glass lightbulb with brass threads & sunburst rays
  eureka: paintSprite((c) => {
    // Radiating yellow burst rays
    for (const [x1, y1, x2, y2] of [
      [16, 4, 16, 1],
      [6, 10, 3, 7],
      [26, 10, 29, 7],
      [5, 16, 2, 16],
      [27, 16, 30, 16],
    ]) {
      c.fillCapsule(x1, y1, x2, y2, 1.0, 0.5, () => RAMPS.gold.hi);
    }
    // Glowing amber glass globe
    c.fillEllipse(16, 13, 7.6, 7.8, 0, (x, y, nx, ny, nz, light) => {
      if (nx < -0.25 && ny < -0.25 && nz > 0.55) return RAMPS.gold.hi;
      return quantRamp(RAMPS.gold, light * 1.15, x, y, 0.02);
    });
    // Neck & ribbed brass screw socket
    c.fillCapsule(16, 20, 16, 26, 3.8, 3.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(y % 2 === 0 ? RAMPS.steel : RAMPS.darkIron, light, x, y, 0.02),
    );
    c.fillEllipse(16, 27.5, 2.2, 1.4, 0, () => RAMPS.gold.mid);
    // Warm filament curl inside bulb
    c.put(14, 12, RAMPS.flame.mid);
    c.put(15, 11, [255, 255, 255]);
    c.put(16, 12, [255, 255, 255]);
    c.put(17, 11, [255, 255, 255]);
    c.put(18, 12, RAMPS.flame.mid);
  }),

  // Overflowing royal gold chalice brimming with coins & sparkles
  golden_age: paintSprite((c) => {
    // Stem & flared pedestal
    c.fillCapsule(16, 17, 16, 25, 2.0, 2.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light, x, y, 0.02),
    );
    c.fillEllipse(16, 26.5, 6.2, 2.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 0.96, x, y, 0.02),
    );
    // Goblet bowl
    c.fillPoly(
      [
        [8, 9],
        [24, 9],
        [21, 18],
        [16, 20],
        [11, 18],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(RAMPS.gold, light * (1.12 - u * 0.25), x, y, 0.02),
    );
    // Heaped coins bubbling out top + center ruby
    for (const [cx, cy] of [
      [12, 8],
      [16, 6.5],
      [20, 8],
      [14, 9.5],
      [18, 9.5],
    ]) {
      c.fillEllipse(cx, cy, 2.3, 1.8, 0, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.gold, light * 1.18, x, y, 0.01),
      );
    }
    c.fillEllipse(16, 14, 2.0, 2.0, 0, () => RAMPS.crimson.light);
    c.sparkle(6, 5, RAMPS.gold.hi, true);
    c.sparkle(26, 7, RAMPS.gold.hi, false);
  }),

  // 3/4 Winged paladin heater shield with beveled silver rim & glowing gold cross
  divine_shield: paintSprite((c) => {
    // Feathered wings flanking upper edges
    for (const dir of [-1, 1]) {
      c.fillPoly(
        [
          [16 + dir * 7, 10],
          [16 + dir * 13, 6],
          [16 + dir * 12, 13],
          [16 + dir * 7, 15],
        ],
        (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.cloud, light * 1.05, x, y, 0.02),
      );
    }
    // Steel rim shield + azure field
    c.fillPoly(
      [
        [7, 7],
        [16, 5],
        [25, 7],
        [24, 19],
        [16, 28],
        [8, 19],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const rim = u < 0.14 || u > 0.86 || v < 0.12 || v > 0.86;
        const cross = Math.abs(u - 0.5) < 0.1 || Math.abs(v - 0.38) < 0.09;
        return quantRamp(rim ? RAMPS.steel : cross ? RAMPS.gold : RAMPS.azure, light * 1.06, x, y, 0.02);
      },
    );
    c.put(16, 13, [255, 255, 240]);
  }),

  // Blazing spiral solar fire vortex with white-hot core & flying embers
  heat_wave: paintSprite((c) => {
    c.fillEllipse(16, 17, 9.5, 9.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 0.92, x, y, 0.04),
    );
    // Curving licking flame tongues
    c.fillBezier(16, 18, 8, 12, 13, 4, 4.5, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.08, x, y, 0.02),
    );
    c.fillBezier(18, 17, 24, 12, 21, 5, 4.0, 0.9, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 0.98, x, y, 0.02),
    );
    c.fillEllipse(16, 19, 4.8, 5.2, 0, () => RAMPS.flame.hi);
    c.sparkle(7, 7, RAMPS.flame.light, false);
    c.sparkle(26, 9, RAMPS.crimson.light, false);
    c.sparkle(16, 3, RAMPS.flame.hi, false);
  }),

  // 6-branch faceted ice crystal snowflake with sapphire core
  freeze_snap: paintSprite((c) => {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 - Math.PI / 6;
      const ex = 16 + Math.cos(a) * 12;
      const ey = 16 + Math.sin(a) * 12;
      c.fillCapsule(16, 16, ex, ey, 1.5, 0.9, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.ice, light * 1.12, x, y, 0.01),
      );
      // Crystalline side barbs
      const bx = 16 + Math.cos(a) * 7.5;
      const by = 16 + Math.sin(a) * 7.5;
      for (const side of [-1, 1]) {
        const ba = a + side * 0.72;
        c.fillCapsule(
          bx,
          by,
          bx + Math.cos(ba) * 3.8,
          by + Math.sin(ba) * 3.8,
          0.9,
          0.5,
          () => RAMPS.ice.hi,
        );
      }
    }
    c.fillEllipse(16, 16, 3.6, 3.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.1, x, y, 0.01),
    );
    c.put(15, 15, [255, 255, 255]);
  }),

  // Twin crossed 45° battle claymores with crimson fullers, gold hilts & sparks
  bloodlust_frenzy: paintSprite((c) => {
    const drawSword = (x1: number, y1: number, x2: number, y2: number, gx1: number, gy1: number, gx2: number, gy2: number) => {
      // Steel blade
      c.fillCapsule(x1, y1, x2, y2, 1.8, 0.6, (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(u < 0.3 ? RAMPS.crimson : RAMPS.steel, light * 1.05, x, y, 0.02),
      );
      // Golden crossguard
      c.fillCapsule(gx1, gy1, gx2, gy2, 1.3, 1.3, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.gold, light, x, y, 0.02),
      );
      // Grip + crimson pommel
      const px = (gx1 + gx2) * 0.5 + ((gx1 + gx2) * 0.5 - x2) * 0.28;
      const py = (gy1 + gy2) * 0.5 + ((gy1 + gy2) * 0.5 - y2) * 0.28;
      c.fillCapsule((gx1 + gx2) * 0.5, (gy1 + gy2) * 0.5, px, py, 1.2, 1.0, () => RAMPS.darkWood.mid);
      c.fillEllipse(px, py, 1.8, 1.8, 0, () => RAMPS.crimson.light);
    };
    drawSword(22, 22, 6, 6, 18, 24, 24, 18);
    drawSword(10, 22, 26, 6, 8, 18, 14, 24);
    c.sparkle(16, 12, RAMPS.flame.hi, true);
    c.sparkle(16, 4, RAMPS.crimson.light, false);
  }),

  // 3/4 Cracked cursed skull with sculpted cheekbones & glowing magenta sockets
  curse: paintSprite((c) => {
    // Jawbone
    c.fillCapsule(12, 22, 20, 22, 3.2, 3.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.bone, light * 0.82, x, y, 0.02),
    );
    // Cranium dome
    c.fillEllipse(16, 13, 8.6, 8.2, -0.08, (x, y, _nx, _ny, _nz, light) => {
      const crack = Math.abs(x - 19 + (y - 9) * 0.35) < 0.6 && y < 14 ? -0.35 : 0;
      return quantRamp(RAMPS.bone, light + crack, x, y, 0.03);
    });
    // Sunken eye sockets with glowing magenta pupils
    c.fillEllipse(12.2, 14.5, 2.5, 2.4, 0, () => RAMPS.arcane.deep);
    c.fillEllipse(19.5, 14.5, 2.5, 2.4, 0, () => RAMPS.arcane.deep);
    c.put(12, 14, RAMPS.arcane.hi);
    c.put(13, 14, RAMPS.arcane.light);
    c.put(19, 14, RAMPS.arcane.hi);
    c.put(20, 14, RAMPS.arcane.light);
    // Nasal cavity + teeth slits
    c.fillPoly(
      [
        [16, 16],
        [17.5, 19],
        [14.5, 19],
      ],
      () => RAMPS.arcane.deep,
    );
    for (const tx of [12, 14, 16, 18, 20]) {
      c.put(tx, 23, RAMPS.arcane.deep);
      c.put(tx, 24, RAMPS.bone.hi);
    }
    c.sparkle(6, 9, RAMPS.arcane.light, false);
    c.sparkle(26, 8, RAMPS.arcane.hi, false);
  }),

  // Tilted corked emerald alchemy vial bubbling with toxic lime brew & vapors
  plague_miasma: paintSprite((c) => {
    // Round tilted glass flask body
    c.fillEllipse(13, 19, 8.0, 7.6, -0.5, (x, y, nx, ny, nz, light) => {
      if (y > 16) {
        const bubble = hash2d(Math.floor(x / 2), Math.floor(y / 2), 99) > 0.72 ? 0.25 : 0;
        return quantRamp(RAMPS.toxic, light * 1.06 + bubble, x, y, 0.02);
      }
      if (nx < -0.3 && ny < -0.3 && nz > 0.5) return RAMPS.glass.hi;
      return quantRamp(RAMPS.glass, light * 0.92, x, y, 0.02);
    });
    // Angled bottle neck + flared glass lip
    c.fillCapsule(17, 14, 22.5, 8.5, 2.7, 2.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.glass, light, x, y, 0.02),
    );
    c.fillEllipse(22.5, 8.5, 3.2, 1.8, 0.78, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.glass, light * 1.05, x, y, 0.02),
    );
    // Warm cork stopper
    c.fillCapsule(22.5, 8.5, 25, 6, 2.2, 2.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.03),
    );
    // Specular streak & floating toxic bubbles
    c.put(9, 15, [255, 255, 255]);
    c.put(8, 16, [255, 255, 255]);
    c.fillEllipse(8, 8, 2.2, 2.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.toxic, light * 1.15, x, y, 0.01),
    );
    c.sparkle(13, 5, RAMPS.toxic.hi, false);
    c.sparkle(25, 21, RAMPS.toxic.light, false);
  }),

  // Dark stormcloud unleashing a searing gold-white forked thunderbolt
  lightning_smite: paintSprite((c) => {
    c.fillEllipse(10, 9, 5.2, 4.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light, x, y, 0.02),
    );
    c.fillEllipse(21, 9.5, 5.0, 3.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light * 0.9, x, y, 0.02),
    );
    c.fillEllipse(16, 7, 6.4, 4.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.65, x, y, 0.02),
    );
    c.fillPoly(
      [
        [15, 11],
        [21, 11],
        [17, 17],
        [22, 17],
        [11, 29],
        [15, 20],
        [11, 20],
      ],
      (x, y, _nx, _ny, _nz, _l, u) =>
        quantRamp(RAMPS.gold, Math.abs(u - 0.5) < 0.2 ? 0.98 : 0.72, x, y, 0.01),
    );
    c.sparkle(23, 23, RAMPS.gold.hi, false);
  }),

  // Swirling multi-tier tornado cyclone funnel whipping debris
  tornado: paintSprite((c) => {
    const tiers: ReadonlyArray<readonly [number, number, number, number]> = [
      [16, 7, 11.5, 3.2],
      [15, 11, 8.8, 2.7],
      [17, 15, 6.8, 2.3],
      [15.5, 19, 4.8, 1.9],
      [17, 23, 3.2, 1.5],
      [15.5, 27, 1.8, 1.2],
    ];
    for (const [cx, cy, rx, ry] of tiers) {
      c.fillEllipse(cx, cy, rx, ry, 0, (x, y, _nx, _ny, _nz, light) =>
        quantRamp(RAMPS.cloud, light * 0.92, x, y, 0.03),
      );
    }
    // Flying pebbles & wind streaks
    c.put(5, 17, RAMPS.wood.mid);
    c.put(26, 15, RAMPS.leaf.light);
    c.put(9, 25, RAMPS.stone.light);
    c.put(23, 24, RAMPS.azure.hi);
  }),

  // Towering curling ocean wave with frothy seafoam crest & droplets
  tsunami: paintSprite((c) => {
    // Deep wave wall & curling arch
    c.fillBezier(6, 25, 4, 6, 21, 8, 5.5, 4.2, (x, y, _nx, _ny, _nz, light, t) =>
      quantRamp(RAMPS.azure, light * (0.85 + t * 0.25), x, y, 0.02),
    );
    c.fillEllipse(18, 23, 9.5, 4.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 0.9, x, y, 0.02),
    );
    // Frothy white seafoam curl on tip + water splash drops
    c.fillEllipse(21, 9, 4.5, 3.2, -0.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.15, x, y, 0.02),
    );
    c.fillEllipse(17, 13, 2.4, 1.8, 0, () => RAMPS.ice.hi);
    c.sparkle(25, 13, RAMPS.ice.hi, false);
    c.sparkle(27, 9, [255, 255, 255], false);
    c.sparkle(9, 24, RAMPS.ice.hi, false);
  }),

  // Blazing craggy asteroid streaking diagonally in roaring plasma tail
  meteor_strike: paintSprite((c) => {
    // Fire trail streaming toward top-right
    c.fillCapsule(12, 20, 27, 5, 6.2, 1.4, (x, y, _nx, _ny, _nz, light, u) =>
      quantRamp(RAMPS.flame, light * (1.15 - u * 0.25), x, y, 0.03),
    );
    // Craggy molten-cracked asteroid sphere bottom-left
    c.fillEllipse(11, 21, 6.8, 6.5, -0.3, (x, y, _nx, _ny, _nz, light) => {
      const magma = hash2d(Math.floor(x / 2), Math.floor(y / 2), 77) > 0.78;
      return quantRamp(magma ? RAMPS.flame : RAMPS.darkIron, light * 1.05, x, y, 0.02);
    });
    c.sparkle(21, 5, RAMPS.flame.hi, false);
    c.sparkle(28, 12, RAMPS.flame.light, false);
  }),

  // 3/4 Isometric granite & grass slab violently cracked by glowing magma fissure
  earthquake: paintSprite((c) => {
    c.fillIsoBox(12, 27, 7, 4, 6, RAMPS.leaf, RAMPS.stone, RAMPS.darkIron);
    c.fillIsoBox(21, 24, 7, 4, 6, RAMPS.leaf, RAMPS.stone, RAMPS.darkIron);
    // Jagged glowing molten chasm in center gap
    c.fillBezier(16, 13, 18, 19, 14, 27, 1.9, 1.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.15, x, y, 0.01),
    );
    // Flying rock chunks
    c.fillEllipse(10, 8, 2.2, 1.8, 0.3, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light, x, y, 0.02),
    );
    c.fillEllipse(23, 7, 1.9, 1.6, -0.3, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light, x, y, 0.02),
    );
  }),

  // Floating emerald prism projecting an iridescent beam onto sprouting earth
  terraform_beam: paintSprite((c) => {
    // Target verdant disc below
    c.fillIsoBox(16, 29, 10, 4.2, 3, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    // Translucent cyan-gold cone beam
    c.fillPoly(
      [
        [14, 12],
        [18, 12],
        [22, 25],
        [10, 25],
      ],
      (x, y, _nx, _ny, _nz, _l, u) =>
        quantRamp(RAMPS.azure, 1.05 - Math.abs(u - 0.5) * 0.9, x, y, 0.02),
    );
    // Floating diamond prism obelisk above
    c.fillPoly(
      [
        [16, 2],
        [21, 8],
        [16, 14],
        [11, 8],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(RAMPS.gold, light + (u < 0.5 ? 0.14 : -0.1), x, y, 0.02),
    );
    c.sparkle(16, 6, [255, 255, 255], false);
  }),

  // Tilted swirling violet cosmic wormhole with glowing accretion disk & stars
  wormhole_ascension: paintSprite((c) => {
    c.fillEllipse(16, 16, 12.2, 8.2, -0.38, (x, y, _nx, _ny, _nz, light) => {
      const swirl = Math.sin(Math.atan2(y - 16, x - 16) * 3 + Math.hypot(x - 16, y - 16) * 0.6) * 0.18;
      return quantRamp(RAMPS.arcane, light + swirl, x, y, 0.03);
    });
    c.fillEllipse(16, 16, 6.2, 4.2, -0.38, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.12, x, y, 0.02),
    );
    c.fillEllipse(16, 16, 2.6, 2.0, -0.38, () => [255, 253, 245]);
    c.sparkle(6, 8, RAMPS.gold.hi, true);
    c.sparkle(26, 23, RAMPS.azure.hi, false);
    c.sparkle(25, 7, RAMPS.arcane.hi, false);
  }),

  // Craggy basalt volcano cone erupting with golden magma fountain & ash cloud
  volcano_eruption: paintSprite((c) => {
    // Ash plume puff high above
    c.fillEllipse(16, 5.5, 6.2, 2.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light * 0.65, x, y, 0.03),
    );
    // Lava fountain jet bursting out
    c.fillBezier(16, 13, 12, 8, 9, 10, 2.2, 0.9, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.15, x, y, 0.02),
    );
    c.fillBezier(16, 13, 20, 8, 23, 10, 2.2, 0.9, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.1, x, y, 0.02),
    );
    // Basalt volcanic mountain cone
    c.fillPoly(
      [
        [3, 28],
        [12, 13],
        [20, 13],
        [29, 28],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const lavaRiver = Math.abs(u - 0.5) < 0.09 && v > 0.08;
        return quantRamp(lavaRiver ? RAMPS.flame : RAMPS.darkIron, light * (lavaRiver ? 1.15 : 0.9), x, y, 0.03);
      },
    );
    c.fillEllipse(16, 13, 4.2, 1.6, 0, () => RAMPS.flame.hi);
    c.sparkle(10, 6, RAMPS.flame.light, false);
    c.sparkle(22, 7, RAMPS.flame.hi, false);
  }),

  // Towering violet-storm super tornado funnel with lightning & flying boulders
  super_tornado: paintSprite((c) => {
    const bands = [
      { y: 7, rx: 12.2, ry: 2.8 },
      { y: 11, rx: 9.2, ry: 2.3 },
      { y: 15, rx: 6.8, ry: 1.9 },
      { y: 19, rx: 4.8, ry: 1.6 },
      { y: 23, rx: 3.1, ry: 1.3 },
      { y: 27, rx: 1.8, ry: 1.0 },
    ];
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const offsetX = i % 2 === 0 ? -0.6 : 0.6;
      c.fillEllipse(16 + offsetX, b.y, b.rx, b.ry, 0, (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(i === 0 ? RAMPS.darkIron : RAMPS.arcane, light * (0.92 + (u - 0.5) * 0.25), x, y, 0.025),
      );
    }
    // Crackling storm bolt along side of funnel
    c.fillCapsule(6, 9, 9, 15, 0.9, 0.7, () => RAMPS.gold.hi);
    c.fillCapsule(9, 15, 7, 19, 0.8, 0.5, () => RAMPS.azure.hi);
    c.fillEllipse(25, 17, 1.8, 1.5, 0, () => RAMPS.stone.light);
    c.sparkle(24, 12, RAMPS.arcane.hi, false);
  }),

  // Bubbling eldritch violet-magenta Void Goo ooze mass with glowing eyes
  void_goo: paintSprite((c) => {
    c.fillEllipse(16, 22, 11.5, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.arcane, light * 0.9, x, y, 0.03),
    );
    c.fillEllipse(16, 16, 8.2, 7.6, 0, (x, y, _nx, _ny, _nz, light) => {
      const bubble = hash2d(Math.floor(x / 2), Math.floor(y / 2), 91) > 0.76;
      return quantRamp(bubble ? RAMPS.pink : RAMPS.arcane, light * 1.05, x, y, 0.025);
    });
    // Rising goo bubbles & tendrils
    c.fillEllipse(8, 10, 2.2, 2.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.pink, light * 1.1, x, y, 0.02),
    );
    c.fillEllipse(24, 12, 1.9, 1.9, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.arcane, light * 1.1, x, y, 0.02),
    );
    c.put(13, 15, RAMPS.gold.hi);
    c.put(19, 15, RAMPS.gold.hi);
    c.sparkle(15, 6, RAMPS.pink.hi, false);
  }),

  // Rune-carved obsidian undead portal gateway glowing with necromantic toxic-violet vortex
  undead_portal: paintSprite((c) => {
    // Stone arch frame
    c.fillIsoBox(16, 29, 11, 4.2, 2.5, RAMPS.darkIron, RAMPS.darkIron, RAMPS.stone);
    c.fillEllipse(16, 15.5, 10.2, 11.5, 0, (x, y, _nx, _ny, _nz, light) => {
      const rune = (x + y) % 5 === 0 && Math.hypot(x - 16, y - 15.5) > 7.5;
      return quantRamp(rune ? RAMPS.toxic : RAMPS.darkIron, light * 0.92, x, y, 0.025);
    });
    // Swirling necromantic portal core
    c.fillEllipse(16, 16, 6.8, 8.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.arcane, light * 1.08, x, y, 0.03),
    );
    c.fillEllipse(16, 16, 4.0, 5.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.toxic, light * 1.15, x, y, 0.02),
    );
    c.sparkle(16, 16, RAMPS.toxic.hi, true);
  }),

  // Chrome flying saucer beaming an emerald tractor beam onto ground below
  alien_invasion: paintSprite((c) => {
    // Glowing emerald abduction/plasma beam cone
    c.fillPoly(
      [
        [13, 15],
        [19, 15],
        [24, 29],
        [8, 29],
      ],
      (x, y, _nx, _ny, _nz, _l, u) =>
        quantRamp(RAMPS.toxic, 1.05 - Math.abs(u - 0.5) * 0.85, x, y, 0.02),
    );
    // Chrome saucer disc
    c.fillEllipse(16, 12, 11.8, 4.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 1.08, x, y, 0.02),
    );
    // Emerald glass cockpit dome
    c.fillEllipse(16, 8.8, 5.6, 3.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.toxic, light * 1.1, x, y, 0.02),
    );
    c.put(9, 12, RAMPS.flame.hi);
    c.put(16, 13, RAMPS.azure.hi);
    c.put(23, 12, RAMPS.flame.hi);
  }),

  // Golden-cyan chrono hourglass/gear radiating temporal speedup arcs
  chrono_surge: paintSprite((c) => {
    c.fillEllipse(16, 16, 11.2, 11.2, 0, (x, y, _nx, _ny, _nz, light) => {
      const ring = Math.hypot(x - 16, y - 16) > 8.6;
      return quantRamp(ring ? RAMPS.gold : RAMPS.azure, light * 1.05, x, y, 0.02);
    });
    // Crisp clock face & golden hands
    c.fillEllipse(16, 16, 7.6, 7.6, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.parchment, light * 1.05, x, y, 0.01),
    );
    c.fillCapsule(16, 16, 16, 9.5, 1.1, 0.9, () => RAMPS.crimson.mid);
    c.fillCapsule(16, 16, 21.5, 18.5, 1.1, 0.8, () => RAMPS.gold.deep);
    c.sparkle(6, 6, RAMPS.azure.hi, true);
    c.sparkle(26, 7, RAMPS.gold.hi, false);
  }),

  // Radiant snow-white peace dove carrying an emerald olive sprig
  harmony_dove: paintSprite((c) => {
    // Radiant golden halo aura
    c.fillEllipse(16, 15, 11, 10, 0, (x, y, _nx, _ny, _nz, light) =>
      Math.hypot(x - 16, y - 15) > 8.5 ? quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02) : null,
    );
    // Spread snow-white wings & body
    c.fillPoly(
      [
        [14, 15],
        [4, 8],
        [7, 17],
        [14, 19],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.cloud, light * 1.06, x, y, 0.02),
    );
    c.fillPoly(
      [
        [16, 14],
        [24, 6],
        [25, 14],
        [18, 18],
      ],
      (x, y, _nx, _ny, _nz, light) => quantRamp(RAMPS.cloud, light * 1.0, x, y, 0.02),
    );
    c.fillEllipse(16, 18.5, 5.8, 4.0, -0.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.08, x, y, 0.02),
    );
    c.fillEllipse(21.5, 14, 3.0, 2.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.cloud, light * 1.1, x, y, 0.01),
    );
    c.put(22.5, 13.5, [20, 14, 14]);
    c.fillCapsule(24, 15, 27, 15.5, 0.7, 0.5, () => RAMPS.gold.light);
    // Tiny emerald olive twig in beak
    c.fillCapsule(25, 16, 28, 19, 0.6, 0.6, () => RAMPS.leaf.light);
    c.put(28, 17, RAMPS.leaf.hi);
  }),

  // Blinding solar orbital laser beam descending onto an incandescent blast ring
  solar_orbital_laser: paintSprite((c) => {
    // Scorched molten ground ring
    c.fillEllipse(16, 25, 11.5, 4.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.12, x, y, 0.02),
    );
    // Outer golden plasma halo beam
    c.fillCapsule(16, 2, 16, 25, 5.0, 6.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.05, x, y, 0.02),
    );
    // White-hot blinding solar core shaft
    c.fillCapsule(16, 2, 16, 25, 2.2, 2.6, () => [255, 254, 232]);
    c.sparkle(8, 22, RAMPS.flame.hi, false);
    c.sparkle(24, 21, RAMPS.gold.hi, false);
  }),

  // Anti-gravity anomaly ripping an earthen island skyward inside an indigo vortex
  gravity_flip: paintSprite((c) => {
    // Swirling indigo gravity field rings
    c.fillEllipse(16, 19, 11.5, 5.0, 0.25, (x, y, _nx, _ny, _nz, light) =>
      Math.abs(Math.hypot((x - 16) / 11.5, (y - 19) / 5.0) - 0.85) < 0.22
        ? quantRamp(RAMPS.arcane, light * 1.1, x, y, 0.02)
        : null,
    );
    // Inverted floating earth/grass island suspended upside down
    c.fillIsoBox(16, 17, 7.5, 3.6, 4.5, RAMPS.darkWood, RAMPS.stone, RAMPS.darkIron);
    c.fillIsoBox(16, 12, 8.2, 3.8, 2.0, RAMPS.leaf, RAMPS.leaf, RAMPS.wood);
    // Floating pebbles & upward cyan chevrons
    c.fillEllipse(7, 10, 1.8, 1.5, 0, () => RAMPS.stone.light);
    c.fillEllipse(25, 9, 1.6, 1.4, 0, () => RAMPS.stone.mid);
    c.fillPoly(
      [
        [16, 21],
        [20, 26],
        [12, 26],
      ],
      () => RAMPS.azure.hi,
    );
  }),
};

export const BUILDING_SPRITES: Record<BuildingType, CompiledSprite> = {
  // Crossed logs in stone hearth with dancing fire & sparks
  bonfire: paintSprite((c) => {
    c.fillIsoBox(16, 28, 11, 5, 3, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillCapsule(9, 23, 23, 19, 1.8, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkWood, light, x, y, 0.02),
    );
    c.fillCapsule(9, 19, 23, 23, 1.8, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillBezier(16, 21, 10, 14, 15, 4, 4.8, 0.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 1.1, x, y, 0.02),
    );
    c.fillBezier(17, 20, 22, 15, 19, 7, 3.6, 0.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.flame, light * 0.98, x, y, 0.02),
    );
    c.fillEllipse(16, 17, 2.4, 3.2, 0, () => RAMPS.flame.hi);
    c.sparkle(11, 6, RAMPS.flame.light, false);
    c.sparkle(22, 5, RAMPS.flame.hi, false);
  }),

  // Cozy thatched A-frame woodland hut on grassy base with warm lantern door
  forager_hut: paintSprite((c) => {
    c.fillIsoBox(16, 28, 11, 5, 2.5, RAMPS.leaf, RAMPS.wood, RAMPS.darkWood);
    c.fillIsoBox(16, 24, 7.5, 4, 7, RAMPS.wood, RAMPS.parchment, RAMPS.wood);
    // Steep thatched pitched roof overhang
    c.fillPoly(
      [
        [6, 17],
        [16, 6],
        [26, 16],
        [16, 21],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const straw = hash2d(x, Math.floor(y / 2), 19) * 0.14;
        return quantRamp(RAMPS.gold, light * (1.0 - v * 0.15) + straw - u * 0.15, x, y, 0.02);
      },
    );
    // Arched glowing door on left wall
    c.fillEllipse(12, 23, 1.8, 2.5, 0, () => RAMPS.flame.light);
  }),

  // Carved stone spirit-mask totem pole with glowing teal eyes & feather crown
  shaman_totem: paintSprite((c) => {
    c.fillIsoBox(16, 29, 9, 4, 2.5, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillCapsule(16, 25, 16, 8, 4.5, 4.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light, x, y, 0.03),
    );
    // Carved wings / ear planks + feathers
    c.fillCapsule(8, 12, 24, 12, 1.6, 1.6, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.wood, light, x, y, 0.02),
    );
    c.fillPoly(
      [
        [12, 7],
        [14, 2],
        [16, 7],
      ],
      () => RAMPS.crimson.light,
    );
    c.fillPoly(
      [
        [16, 7],
        [18, 2],
        [20, 7],
      ],
      () => RAMPS.gold.light,
    );
    // Glowing cyan spirit eyes
    c.put(14, 11, RAMPS.azure.hi);
    c.put(18, 11, RAMPS.azure.hi);
    c.fillCapsule(14, 18, 18, 18, 0.9, 0.9, () => RAMPS.flame.mid);
  }),

  // Round timber-hooped silo granary topped with conical golden-straw dome
  granary: paintSprite((c) => {
    c.fillIsoBox(16, 28, 10, 4.5, 2.5, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillCapsule(16, 24, 16, 13, 6.2, 6.2, (x, y, _nx, _ny, _nz, light) => {
      const hoop = y === 17 || y === 22;
      return quantRamp(hoop ? RAMPS.darkIron : RAMPS.parchment, light, x, y, 0.02);
    });
    // Conical golden-thatch dome
    c.fillPoly(
      [
        [8, 13],
        [16, 4],
        [24, 13],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(RAMPS.gold, light * (1.12 - u * 0.25), x, y, 0.02),
    );
    c.fillEllipse(16, 23, 2.0, 2.4, 0, () => RAMPS.darkWood.deep);
  }),

  // Brick blast furnace with smoking stack and molten gold crucible
  smeltery: paintSprite((c) => {
    // Tall stone chimney back-right
    c.fillCapsule(22, 23, 22, 7, 2.8, 2.4, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light * 0.88, x, y, 0.02),
    );
    c.fillEllipse(22, 4, 2.6, 1.8, 0, () => RAMPS.cloud.mid);
    // Brick furnace block
    c.fillIsoBox(14, 27, 9, 4.5, 10, RAMPS.stone, RAMPS.terracotta, RAMPS.crimson);
    // Glowing molten furnace hearth mouth
    c.fillEllipse(11, 22, 2.5, 3.0, 0, () => RAMPS.flame.hi);
    c.put(11, 22, [255, 255, 240]);
  }),

  // Grand 3-tiered sandstone step pyramid crowned by glowing sun altar
  ziggurat: paintSprite((c) => {
    c.fillIsoBox(16, 28, 13, 5.8, 4, RAMPS.sandstone, RAMPS.sandstone, RAMPS.darkWood);
    c.fillIsoBox(16, 23, 9.5, 4.4, 4, RAMPS.sandstone, RAMPS.sandstone, RAMPS.darkWood);
    c.fillIsoBox(16, 18, 6, 2.8, 4, RAMPS.gold, RAMPS.sandstone, RAMPS.darkWood);
    c.fillEllipse(16, 9, 2.5, 2.5, 0, () => RAMPS.gold.hi);
    c.sparkle(16, 4, RAMPS.gold.hi, true);
  }),

  // Half-timbered medieval guildhall with terracotta tile roof & glowing window
  guildhall: paintSprite((c) => {
    c.fillIsoBox(16, 28, 10.5, 5, 9, RAMPS.terracotta, RAMPS.parchment, RAMPS.wood);
    c.fillPoly(
      [
        [5, 16],
        [16, 5],
        [27, 16],
        [16, 21],
      ],
      (x, y, _nx, _ny, _nz, light, u, v) => {
        const tile = Math.floor(v * 6) % 2 === 0 ? 0.06 : -0.05;
        return quantRamp(RAMPS.terracotta, light * (1.1 - u * 0.2) + tile, x, y, 0.02);
      },
    );
    // Oak beams + warm glowing window + banner
    c.fillCapsule(10, 18, 10, 26, 0.7, 0.7, () => RAMPS.darkWood.dark);
    c.fillEllipse(12.5, 24, 1.5, 2.2, 0, () => RAMPS.flame.light);
    c.fillPoly(
      [
        [19, 17],
        [22, 17],
        [22, 23],
        [20.5, 21],
        [19, 23],
      ],
      () => RAMPS.gold.light,
    );
  }),

  // Limestone observatory with cerulean dome & gleaming brass telescope
  observatory: paintSprite((c) => {
    c.fillIsoBox(16, 28, 9, 4.2, 2.5, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillCapsule(16, 25, 16, 14, 6.2, 6.2, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.parchment, light, x, y, 0.02),
    );
    c.fillEllipse(16, 13, 6.8, 6.2, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.05, x, y, 0.02),
    );
    // Protruding brass telescope aimed top-right
    c.fillCapsule(17, 11, 26, 4, 1.5, 1.9, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.1, x, y, 0.02),
    );
    c.fillEllipse(12, 23, 1.5, 2.2, 0, () => RAMPS.azure.deep);
  }),

  // Riveted red-brick & iron Victorian steam foundry with twin smokestacks
  steam_foundry: paintSprite((c) => {
    // Twin smokestacks
    c.fillCapsule(11, 17, 11, 5, 2.0, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light, x, y, 0.02),
    );
    c.fillCapsule(19, 16, 19, 4, 2.0, 1.8, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.darkIron, light * 0.9, x, y, 0.02),
    );
    c.fillEllipse(12, 3, 2.2, 1.4, 0, () => RAMPS.cloud.light);
    c.fillEllipse(20, 2.5, 2.2, 1.4, 0, () => RAMPS.cloud.mid);
    // Main brick & steel factory hall
    c.fillIsoBox(16, 28, 11, 5, 9.5, RAMPS.steel, RAMPS.terracotta, RAMPS.crimson);
    c.fillEllipse(11, 22, 2.3, 2.5, 0, () => RAMPS.flame.hi);
    c.put(20, 21, RAMPS.flame.light);
    c.put(23, 20, RAMPS.flame.light);
  }),

  // Copper-coiled Tesla dynamo plant topped by crackling electric arcs
  dynamo_plant: paintSprite((c) => {
    c.fillIsoBox(16, 28, 10.5, 4.8, 7.5, RAMPS.steel, RAMPS.darkIron, RAMPS.darkIron);
    // Copper-coil Tesla column + glowing sphere
    c.fillCapsule(16, 17, 16, 8, 2.5, 2.1, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(y % 2 === 0 ? RAMPS.gold : RAMPS.wood, light, x, y, 0.02),
    );
    c.fillEllipse(16, 6.5, 3.6, 3.0, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.15, x, y, 0.02),
    );
    c.sparkle(8, 7, RAMPS.azure.hi, true);
    c.sparkle(24, 8, RAMPS.gold.hi, false);
    c.fillCapsule(10, 22, 14, 24, 1.2, 1.2, () => RAMPS.azure.hi);
  }),

  // Victorian brick rail station depot with gabled clocktower, canopy & steel rails
  rail_station: paintSprite((c) => {
    c.fillIsoBox(16, 28, 12, 5.2, 2.5, RAMPS.stone, RAMPS.stone, RAMPS.darkIron);
    c.fillIsoBox(16, 24, 9.5, 4.2, 6.5, RAMPS.terracotta, RAMPS.parchment, RAMPS.wood);
    // Pitched red-slate canopy roof
    c.fillPoly(
      [
        [6, 17],
        [16, 10],
        [26, 17],
        [16, 20],
      ],
      (x, y, _nx, _ny, _nz, light, u) =>
        quantRamp(RAMPS.crimson, light * (1.1 - u * 0.2), x, y, 0.02),
    );
    // Clock tower peak
    c.fillCapsule(16, 13, 16, 6, 3.0, 2.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.terracotta, light, x, y, 0.02),
    );
    c.fillEllipse(16, 9, 2.1, 2.1, 0, () => RAMPS.parchment.hi);
    c.put(16, 9, [20, 14, 12]);
    // Arched glowing train bays + steel rails along platform edge
    c.fillEllipse(12, 22, 1.6, 2.0, 0, () => RAMPS.flame.light);
    c.fillCapsule(8, 25, 16, 28, 0.7, 0.7, () => RAMPS.steel.hi);
    c.fillCapsule(16, 28, 24, 25, 0.7, 0.7, () => RAMPS.steel.light);
  }),

  // Containment dome & hyperboloid cooling tower pulsing with emerald Cherenkov glow
  fission_reactor: paintSprite((c) => {
    // Cooling tower right
    c.fillCapsule(21, 24, 21, 8, 4.2, 3.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.stone, light * 0.9, x, y, 0.02),
    );
    c.fillEllipse(21, 5, 3.2, 1.8, 0, () => RAMPS.cloud.light);
    // Steel containment dome left
    c.fillEllipse(11.5, 20, 6.8, 7.5, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light, x, y, 0.02),
    );
    // Emerald glowing core visor
    c.fillEllipse(11.5, 21, 3.2, 2.8, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.toxic, light * 1.15, x, y, 0.01),
    );
    c.put(10.5, 20, [255, 255, 240]);
  }),

  // Sleek obsidian-glass cybernetic spire with glowing holographic cyan bands
  cyber_institute: paintSprite((c) => {
    c.fillIsoBox(16, 28, 10, 4.5, 3, RAMPS.darkIron, RAMPS.darkIron, RAMPS.steel);
    c.fillIsoBox(16, 24, 7.5, 3.8, 12, RAMPS.azure, RAMPS.darkIron, RAMPS.steel);
    // Glowing holographic cyan visor bands
    c.fillCapsule(10, 15, 16, 18, 1.0, 1.0, () => RAMPS.azure.hi);
    c.fillCapsule(16, 18, 22, 15, 1.0, 1.0, () => RAMPS.azure.light);
    c.fillCapsule(10, 20, 16, 23, 0.9, 0.9, () => RAMPS.azure.hi);
    // Comms spire
    c.fillCapsule(16, 9, 16, 2, 0.9, 0.6, () => RAMPS.azure.hi);
    c.sparkle(16, 2, [255, 255, 255], true);
  }),

  // Swept ATC radar control tower beside terminal & striped tarmac runway
  airport: paintSprite((c) => {
    // Runway tarmac base with dashed centerline
    c.fillIsoBox(16, 28, 12.5, 5.5, 2.5, RAMPS.darkIron, RAMPS.darkIron, RAMPS.stone);
    c.put(9, 24, RAMPS.gold.hi);
    c.put(13, 25, RAMPS.gold.hi);
    c.put(17, 25, RAMPS.gold.hi);
    // Terminal hall left + tall ATC tower right
    c.fillIsoBox(10, 24, 5.5, 2.8, 5, RAMPS.steel, RAMPS.cloud, RAMPS.steel);
    c.fillCapsule(22, 23, 22, 10, 2.0, 2.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light, x, y, 0.02),
    );
    c.fillEllipse(22, 9, 4.4, 2.4, 0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.1, x, y, 0.02),
    );
    c.sparkle(22, 5, RAMPS.flame.light, false);
  }),

  // Steel launch gantry cradling a white-and-orange orbital rocket firing exhaust
  launch_arcology: paintSprite((c) => {
    c.fillIsoBox(16, 29, 11, 4.8, 3.5, RAMPS.darkIron, RAMPS.darkIron, RAMPS.steel);
    // Launch gantry frame right
    c.fillCapsule(23, 25, 23, 7, 1.5, 1.5, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.steel, light * 0.85, x, y, 0.02),
    );
    c.fillCapsule(16, 12, 23, 12, 0.9, 0.9, () => RAMPS.steel.mid);
    // White-and-orange rocket centered
    c.fillCapsule(14, 22, 14, 6, 3.0, 1.2, (x, y, _nx, _ny, _nz, light, u) =>
      quantRamp(u > 0.72 ? RAMPS.terracotta : RAMPS.cloud, light * 1.05, x, y, 0.02),
    );
    c.fillEllipse(14, 25, 2.4, 2.2, 0, () => RAMPS.flame.hi);
  }),

  // Celestial golden-and-cyan Dyson space elevator spire piercing orbital rings
  dyson_spire: paintSprite((c) => {
    c.fillIsoBox(16, 29, 9.5, 4.2, 3, RAMPS.darkIron, RAMPS.steel, RAMPS.darkIron);
    // Gleaming central golden spire
    c.fillCapsule(16, 26, 16, 3, 2.2, 1.0, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.gold, light * 1.12, x, y, 0.02),
    );
    // Twin tilted holographic cyan orbital rings
    c.fillEllipse(16, 10, 10, 2.6, -0.15, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.12, x, y, 0.02),
    );
    c.fillEllipse(16, 18, 8.5, 2.2, 0.15, (x, y, _nx, _ny, _nz, light) =>
      quantRamp(RAMPS.azure, light * 1.08, x, y, 0.02),
    );
    c.sparkle(16, 14, [255, 255, 255], true);
  }),
};
