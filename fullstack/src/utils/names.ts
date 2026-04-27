const ADJECTIVES = [
  "Crimson", "Neon", "Violet", "Azure", "Emerald", "Golden", "Silver",
  "Cosmic", "Phantom", "Shadow", "Mystic", "Blazing", "Frozen", "Electric",
  "Lunar", "Solar", "Iron", "Crystal", "Obsidian", "Amber", "Coral",
  "Indigo", "Scarlet", "Jade", "Onyx", "Ruby", "Cobalt", "Ivory",
  "Sapphire", "Turquoise", "Copper", "Bronze", "Platinum", "Magenta",
  "Lavender", "Teal", "Crimson", "Ochre", "Mint", "Peach", "Rust",
  "Storm", "Thunder", "Pixel", "Glitch", "Cyber", "Retro", "Nova",
  "Prism", "Dusk", "Dawn",
];

const NOUNS = [
  "Falcon", "Panda", "Wolf", "Tiger", "Fox", "Hawk", "Dragon",
  "Phoenix", "Panther", "Cobra", "Viper", "Eagle", "Shark", "Lion",
  "Raven", "Lynx", "Jaguar", "Otter", "Mantis", "Hornet", "Gecko",
  "Crane", "Badger", "Bison", "Moose", "Owl", "Sparrow", "Dingo",
  "Ferret", "Toucan", "Macaw", "Wombat", "Quokka", "Koi", "Coyote",
  "Penguin", "Koala", "Stag", "Heron", "Manta", "Puma", "Gazelle",
  "Osprey", "Condor", "Ibis", "Lemur", "Ocelot", "Piranha",
  "Orca", "Beetle",
];

/**
 * Generate a unique display name like "NeonFalcon" or "CrimsonPanda".
 * Appends a 2-digit suffix for extra uniqueness.
 */
export function generateUniqueName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const suffix = Math.floor(Math.random() * 100)
    .toString()
    .padStart(2, "0");
  return `${adj}${noun}${suffix}`;
}
