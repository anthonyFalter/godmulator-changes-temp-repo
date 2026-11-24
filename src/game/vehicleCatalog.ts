import type { SpeciesId, VehicleType } from './types';

export type VehicleDomain = 'sea' | 'land' | 'air' | 'orbital';

export interface MilitaryVehicleStats {
  maxHp: number;
  speed: number;
  fireRange: number;
  fireCooldown: number;
  dmg: number;
  cruiseY: number;
  domain: VehicleDomain;
  minEpoch: number;
}

export interface VehicleProgressionTier {
  epoch: number;
  label: string;
}

export const ALL_MILITARY_VEHICLE_TYPES: readonly VehicleType[] = [
  'warship',
  'submarine',
  'aircraft_carrier',
  'tank',
  'siege_artillery',
  'glider',
  'bomber_plane',
  'airship',
  'helicopter',
  'orc_flyer',
  'sky_cannonship',
  'sky_carrier',
  'orbital_gunship',
  'orbital_mothership',
] as const;

export function isNavalMilitaryType(vType: VehicleType): boolean {
  return vType === 'warship' || vType === 'submarine' || vType === 'aircraft_carrier';
}

export function isGroundMilitaryType(vType: VehicleType): boolean {
  return vType === 'tank' || vType === 'siege_artillery';
}

export function isAirOrOrbitalMilitaryType(vType: VehicleType): boolean {
  return (
    vType === 'glider' ||
    vType === 'bomber_plane' ||
    vType === 'airship' ||
    vType === 'helicopter' ||
    vType === 'orc_flyer' ||
    vType === 'sky_cannonship' ||
    vType === 'sky_carrier' ||
    vType === 'orbital_gunship' ||
    vType === 'orbital_mothership'
  );
}

/**
 * Single source of truth for military vehicle combat stats, cruising altitude,
 * and effective attack range (used by simulation combat, Entity Inspector, and 3D range rings).
 */
export function getMilitaryVehicleStats(mType: VehicleType, epochIdx: number): MilitaryVehicleStats {
  const e = Math.max(1, epochIdx);
  const tierBoost = 1 + (e - 1) * 0.24;

  switch (mType) {
    case 'warship':
      return {
        maxHp: Math.round(210 * tierBoost),
        speed: 2.9 + Math.min(3.0, (e - 1) * 0.45),
        fireRange: e >= 6 ? 13.5 : e >= 4 ? 11.5 : e >= 3 ? 10.5 : 9.5,
        fireCooldown: Math.max(1.25, 2.25 - (e - 1) * 0.16),
        dmg: Math.round(30 * (1 + (e - 1) * 0.3)),
        cruiseY: e >= 6 ? 0.24 : 0.14,
        domain: 'sea',
        minEpoch: 1,
      };
    case 'submarine':
      return {
        maxHp: Math.round(230 * (1 + Math.max(0, e - 3) * 0.26)),
        speed: 3.4 + Math.max(0, e - 3) * 0.45,
        fireRange: e >= 6 ? 14.5 : e >= 5 ? 13.0 : e >= 4 ? 12.0 : 11.0,
        fireCooldown: Math.max(1.35, 2.2 - Math.max(0, e - 3) * 0.18),
        dmg: Math.round(44 * (1 + Math.max(0, e - 3) * 0.32)),
        cruiseY: 0.04,
        domain: 'sea',
        minEpoch: 3,
      };
    case 'aircraft_carrier':
      return {
        maxHp: Math.round(420 * (1 + Math.max(0, e - 3) * 0.28)),
        speed: 2.25 + Math.max(0, e - 3) * 0.3,
        fireRange: e >= 6 ? 17.5 : e >= 5 ? 16.0 : e >= 4 ? 15.0 : 14.0,
        fireCooldown: Math.max(1.35, 2.1 - Math.max(0, e - 3) * 0.15),
        dmg: Math.round(46 * (1 + Math.max(0, e - 3) * 0.32)),
        cruiseY: e >= 6 ? 0.26 : 0.16,
        domain: 'sea',
        minEpoch: 3,
      };
    case 'tank':
      return {
        maxHp: Math.round(260 * (1 + Math.max(0, e - 3) * 0.26)),
        speed: e >= 6 ? 4.4 : 2.7 + Math.max(0, e - 3) * 0.42,
        fireRange: e >= 6 ? 10.5 : 8.0 + Math.max(0, e - 3) * 0.5,
        fireCooldown: Math.max(1.3, 2.05 - Math.max(0, e - 3) * 0.18),
        dmg: Math.round(36 * (1 + Math.max(0, e - 3) * 0.32)),
        cruiseY: e >= 6 ? 0.24 : 0.05,
        domain: 'land',
        minEpoch: 3,
      };
    case 'siege_artillery':
      return {
        maxHp: Math.round(310 * (1 + Math.max(0, e - 3) * 0.27)),
        speed: e >= 6 ? 3.2 : 2.0 + Math.max(0, e - 3) * 0.28,
        fireRange: e >= 6 ? 16.0 : e >= 5 ? 14.5 : e >= 4 ? 13.5 : 12.5,
        fireCooldown: Math.max(1.6, 2.55 - Math.max(0, e - 3) * 0.2),
        dmg: Math.round(54 * (1 + Math.max(0, e - 3) * 0.34)),
        cruiseY: e >= 6 ? 0.22 : 0.05,
        domain: 'land',
        minEpoch: 3,
      };
    case 'sky_cannonship':
      return {
        maxHp: Math.round(370 * (1 + Math.max(0, e - 4) * 0.28)),
        speed: 4.2 + Math.max(0, e - 4) * 0.48,
        fireRange: e >= 6 ? 17.0 : e >= 5 ? 15.2 : 13.8,
        fireCooldown: Math.max(1.15, 1.85 - Math.max(0, e - 4) * 0.16),
        dmg: Math.round(52 * (1 + Math.max(0, e - 4) * 0.32)),
        cruiseY: 4.85,
        domain: 'air',
        minEpoch: 4,
      };
    case 'sky_carrier':
      return {
        maxHp: Math.round(520 * (1 + Math.max(0, e - 5) * 0.3)),
        speed: 3.6 + Math.max(0, e - 5) * 0.42,
        fireRange: e >= 7 ? 19.5 : e >= 6 ? 17.8 : 16.0,
        fireCooldown: Math.max(1.2, 1.75 - Math.max(0, e - 5) * 0.15),
        dmg: Math.round(58 * (1 + Math.max(0, e - 5) * 0.34)),
        cruiseY: 5.95,
        domain: 'air',
        minEpoch: 5,
      };
    case 'orbital_gunship':
      return {
        maxHp: Math.round(360 * (1 + Math.max(0, e - 6) * 0.3)),
        speed: 8.4 + Math.max(0, e - 6) * 0.9,
        fireRange: e >= 7 ? 15.0 : 13.5,
        fireCooldown: Math.max(1.05, 1.45 - Math.max(0, e - 6) * 0.15),
        dmg: Math.round(48 * (1 + Math.max(0, e - 6) * 0.35)),
        cruiseY: 6.4,
        domain: 'orbital',
        minEpoch: 6,
      };
    case 'orbital_mothership':
      return {
        maxHp: Math.round(780 * (1 + Math.max(0, e - 6) * 0.36)),
        speed: 3.1 + Math.max(0, e - 6) * 0.55,
        fireRange: e >= 7 ? 22.0 : 19.0,
        fireCooldown: Math.max(1.25, 1.7 - Math.max(0, e - 6) * 0.2),
        dmg: Math.round(78 * (1 + Math.max(0, e - 6) * 0.38)),
        cruiseY: 7.45,
        domain: 'orbital',
        minEpoch: 6,
      };
    case 'helicopter':
      return {
        maxHp: Math.round(215 * (1 + Math.max(0, e - 4) * 0.24)),
        speed: 4.9 + Math.max(0, e - 4) * 0.55,
        fireRange: 9.2,
        fireCooldown: Math.max(0.85, 1.35 - Math.max(0, e - 4) * 0.14),
        dmg: Math.round(28 * (1 + Math.max(0, e - 4) * 0.28)),
        cruiseY: 3.55,
        domain: 'air',
        minEpoch: 4,
      };
    case 'bomber_plane':
      return {
        maxHp: Math.round(240 * (1 + Math.max(0, e - 4) * 0.25)),
        speed: 7.4 + Math.max(0, e - 4) * 0.85,
        fireRange: 11.4,
        fireCooldown: Math.max(1.65, 2.35 - Math.max(0, e - 4) * 0.18),
        dmg: Math.round(52 * (1 + Math.max(0, e - 4) * 0.28)),
        cruiseY: 5.2,
        domain: 'air',
        minEpoch: 4,
      };
    case 'airship':
    case 'orc_flyer':
      return {
        maxHp:
          mType === 'airship'
            ? Math.round(220 * (1 + Math.max(0, e - 3) * 0.22))
            : Math.round(210 * (1 + Math.max(0, e - 4) * 0.25)),
        speed: (mType === 'orc_flyer' ? 5.1 : 4.3) + Math.max(0, e - 3) * 0.35,
        fireRange: mType === 'airship' ? 10.2 : 8.5,
        fireCooldown: Math.max(1.25, 1.8 - Math.max(0, e - 3) * 0.12),
        dmg: Math.round((mType === 'orc_flyer' ? 32 : 28) * (1 + Math.max(0, e - 3) * 0.24)),
        cruiseY: mType === 'airship' ? 4.0 : 3.4,
        domain: 'air',
        minEpoch: mType === 'airship' ? 3 : 4,
      };
    default:
      return {
        maxHp: Math.round(145 * (1 + Math.max(0, e - 3) * 0.28)),
        speed: 6.4 + Math.max(0, e - 3) * 0.45,
        fireRange: 8.2,
        fireCooldown: 1.35,
        dmg: Math.round(26 * (1 + Math.max(0, e - 3) * 0.25)),
        cruiseY: 3.1,
        domain: 'air',
        minEpoch: 3,
      };
  }
}

const RACE_PREFIX: Record<string, string> = {
  human: 'Imperial',
  elf: 'Sylvan',
  orc: 'Ironjaw',
  dwarf: 'Runeforge',
  lizardfolk: 'Solar',
};

export function getVehicleDisplayName(
  vType: VehicleType,
  epochIdx: number,
  species: SpeciesId,
): string {
  const e = Math.max(0, epochIdx);
  const rp = RACE_PREFIX[species] ?? 'Allied';

  switch (vType) {
    case 'warship':
      if (e <= 1) return `${rp} War Galley`;
      if (e === 2) return `${rp} Cannon Galleon`;
      if (e === 3) return `${rp} Steam Ironclad`;
      if (e === 4) return `${rp} Dreadnought Cruiser`;
      if (e === 5) return `${rp} Aegis Missile Destroyer`;
      return `${rp} Plasma Hydro-Cruiser`;
    case 'submarine':
      if (e === 3) {
        return species === 'dwarf'
          ? 'Runeforge Iron-Beetle Sub'
          : species === 'orc'
            ? 'Shark-Jaw Submersible'
            : species === 'elf'
              ? 'Manta Nautilus'
              : species === 'lizardfolk'
                ? 'Caiman Reef-Sub'
                : 'Diesel U-Submarine';
      }
      if (e === 4) return `${rp} Nuclear Submarine`;
      if (e === 5) return `${rp} Stealth Torpedo Sub`;
      return `${rp} Abyssal Plasma Sub`;
    case 'aircraft_carrier':
      if (e === 3) return `${rp} Seaplane Tender`;
      if (e === 4) {
        return species === 'dwarf'
          ? 'Twin-Hull Forge Carrier'
          : species === 'elf'
            ? 'Sun-Sail Wing Carrier'
            : species === 'orc'
              ? 'Dakka Flat-Top Hulk'
              : species === 'lizardfolk'
                ? 'Temple-Deck Sea Ark'
                : 'Fleet Aircraft Carrier';
      }
      if (e === 5) return `${rp} Nuclear Supercarriers`;
      return `${rp} Aegis Plasma Carrier`;
    case 'tank':
      if (e === 3) return `${rp} Trench Landship`;
      if (e === 4) return `${rp} Heavy Battle Tank`;
      if (e === 5) return `${rp} Composite MBT`;
      return `${rp} Hover Rail-Tank`;
    case 'siege_artillery':
      if (e === 3) {
        return species === 'dwarf'
          ? 'Runeforge Quake-Mortar Crawler'
          : species === 'orc'
            ? 'Spiked Doom-Kannon Roller'
            : species === 'elf'
              ? 'Prism-Lance Strider'
              : species === 'lizardfolk'
                ? 'Obsidian Sun-Obelisk Walker'
                : 'Heavy Siege Howitzer';
      }
      if (e === 4) return `${rp} Heavy Artillery Crawler`;
      if (e === 5) return `${rp} Long-Range Rail-Battery`;
      return `${rp} Plasma Siege Walker`;
    case 'sky_cannonship':
      if (e <= 4) {
        return species === 'dwarf'
          ? 'Runeforge Brass Sky-Dreadnought'
          : species === 'orc'
            ? 'Orc Sky-Krusher Gunbarge'
            : species === 'elf'
              ? 'Star-Sail Sky Frigate'
              : species === 'lizardfolk'
                ? 'Solar Temple Sky-Barge'
                : 'Armored Sky Cannonship';
      }
      if (e === 5) return `${rp} Aerial Broadside Cruiser`;
      return `${rp} Ion Sky-Dreadnought`;
    case 'sky_carrier':
      if (e <= 5) {
        return species === 'dwarf'
          ? 'Twin-Furnace Sky Fortress'
          : species === 'orc'
            ? 'Ironjaw Mega-Helihulk'
            : species === 'elf'
              ? 'Celestial Lotus Sky-Carrier'
              : species === 'lizardfolk'
                ? 'Sun-Disc Wing Carrier'
                : 'Stratospheric Helicarrier';
      }
      return `${rp} Orbital-Grade Sky Carrier`;
    case 'orbital_gunship':
      return e >= 7 ? `${rp} Star-Interceptor Gunship` : `${rp} Orbital Gunship`;
    case 'orbital_mothership':
      if (species === 'elf') return e >= 7 ? 'Celestial Star-Lotus Ark' : 'Sylvan Orbital Spire-Ship';
      if (species === 'orc') return e >= 7 ? 'Da World-Krusher Mega-Hulk' : 'Ironjaw Orbital War-Hulk';
      if (species === 'dwarf') return e >= 7 ? 'Dyson-Anvil Star Bastion' : 'Runeforge Orbital Citadel';
      if (species === 'lizardfolk') return e >= 7 ? 'Grand Solar Ziggurat Ark' : 'Obsidian Sun-Mothership';
      return e >= 7 ? 'Interstellar Ring-Ark Mothership' : 'Orbital Command Mothership';
    case 'bomber_plane':
      if (e <= 4) return `${rp} Heavy Prop Bomber`;
      if (e === 5) return `${rp} Stealth Jet Bomber`;
      return `${rp} Plasma Delta Bomber`;
    case 'helicopter':
      return e >= 5 ? `${rp} Attack Gunship` : `${rp} Assault Helicopter`;
    case 'orc_flyer':
      return e >= 5 ? 'Ironjaw Dread-Kopter' : 'Orc Skull-Chopper';
    case 'airship':
      return `${rp} War Zeppelin`;
    case 'glider':
      return `${rp} Biplane Fighter`;
    default:
      return `${rp} ${vType.replace(/_/g, ' ')}`;
  }
}

export function getVehicleProgressionTrack(vType: VehicleType): VehicleProgressionTier[] {
  switch (vType) {
    case 'warship':
      return [
        { epoch: 1, label: 'Galley' },
        { epoch: 2, label: 'Galleon' },
        { epoch: 3, label: 'Ironclad' },
        { epoch: 4, label: 'Cruiser' },
        { epoch: 5, label: 'Destroyer' },
        { epoch: 6, label: 'Plasma' },
      ];
    case 'submarine':
      return [
        { epoch: 3, label: 'Diesel Sub' },
        { epoch: 4, label: 'Nuclear Sub' },
        { epoch: 5, label: 'Stealth Sub' },
        { epoch: 6, label: 'Abyssal' },
      ];
    case 'aircraft_carrier':
      return [
        { epoch: 3, label: 'Tender' },
        { epoch: 4, label: 'Carrier' },
        { epoch: 5, label: 'Supercarrier' },
        { epoch: 6, label: 'Plasma Ark' },
      ];
    case 'tank':
      return [
        { epoch: 3, label: 'Landship' },
        { epoch: 4, label: 'Heavy Tank' },
        { epoch: 5, label: 'MBT' },
        { epoch: 6, label: 'Hover Rail' },
      ];
    case 'siege_artillery':
      return [
        { epoch: 3, label: 'Siege Gun' },
        { epoch: 4, label: 'Howitzer' },
        { epoch: 5, label: 'Rail Battery' },
        { epoch: 6, label: 'Siege Walker' },
      ];
    case 'sky_cannonship':
      return [
        { epoch: 4, label: 'Sky Gunboat' },
        { epoch: 5, label: 'Sky Cruiser' },
        { epoch: 6, label: 'Ion Dreadnought' },
      ];
    case 'sky_carrier':
      return [
        { epoch: 5, label: 'Helicarrier' },
        { epoch: 6, label: 'Sky Ark' },
        { epoch: 7, label: 'Star Carrier' },
      ];
    case 'orbital_mothership':
      return [
        { epoch: 6, label: 'Orbital Capital' },
        { epoch: 7, label: 'Interstellar Ark' },
      ];
    default:
      return [
        { epoch: 3, label: 'Industrial' },
        { epoch: 4, label: 'Atomic' },
        { epoch: 5, label: 'Info' },
        { epoch: 6, label: 'Orbital' },
      ];
  }
}
