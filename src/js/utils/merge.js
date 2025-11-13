import { getAppIcon } from "./icons.js";

/**
 * Merge app from different sources into one unified entry
 * Handles packages from official repos, AUR, and Flatpak
 */
export function mergeAppSources(baseName, packages) {
  if (packages.length === 0) return null;

  const sources = {};
  let primaryPackage = null;

  // Add all packages from different sources
  packages.forEach((pkg) => {
    // Prefer official > flatpak > aur for the same source
    if (!sources[pkg.source] || pkg.source === "official") {
      sources[pkg.source] = pkg;
    }

    // Set primary package (prefer official)
    if (!primaryPackage || pkg.source === "official") {
      primaryPackage = pkg;
    }
  });

  if (!primaryPackage) return null;

  // Use the cleanest name for display
  let displayName = baseName;

  // Special case nice names
  const niceNames = {
    firefox: "Firefox",
    chromium: "Chromium",
    brave: "Brave Browser",
    code: "Visual Studio Code",
    git: "Git",
    docker: "Docker",
    python: "Python",
    nodejs: "Node.js",
    vlc: "VLC Media Player",
    mpv: "MPV",
    gimp: "GIMP",
    "obs-studio": "OBS Studio",
    kdenlive: "Kdenlive",
    blender: "Blender",
    "libreoffice-fresh": "LibreOffice",
    thunderbird: "Thunderbird",
    discord: "Discord",
    "telegram-desktop": "Telegram",
    spotify: "Spotify",
    htop: "htop",
    steam: "Steam",
  };

  if (niceNames[baseName]) {
    displayName = niceNames[baseName];
  } else if (sources.flatpak) {
    // Extract app name from Flatpak description
    const flatpakDesc = sources.flatpak.description || "";
    const parts = flatpakDesc.split(" - ");
    if (parts.length > 0 && parts[0].trim()) {
      displayName = parts[0].trim();
    }
  } else if (sources.official) {
    displayName = sources.official.name;
  } else if (sources.aur) {
    displayName = sources.aur.name;
  }

  // Get description from the best source
  let description = primaryPackage.description;
  if (sources.flatpak && sources.flatpak.description.includes(" - ")) {
    description = sources.flatpak.description.split(" - ")[1] || description;
  }

  return {
    name: baseName,
    displayName: displayName,
    description: description,
    version: primaryPackage.version,
    sources: sources,
    icon: getAppIcon(baseName),
  };
}

/**
 * Get relevance score for search ranking
 */
export function getRelevanceScore(pkg, query) {
  const lowerDesc = (pkg.description || "").toLowerCase();
  // Use the package name for scoring
  const displayName = pkg.displayName || pkg.name;

  const nameLower = displayName.toLowerCase();
  const queryLower = query.toLowerCase();

  // Strip common prefixes for more flexible matching
  let cleanName = nameLower;
  if (cleanName.startsWith("lib")) {
    cleanName = cleanName.substring(3);
  }

  // Exact match (highest score)
  if (nameLower === queryLower || cleanName === queryLower) return 1000;

  // Starts with query
  if (nameLower.startsWith(queryLower) || cleanName.startsWith(queryLower))
    return 500;

  // Contains query
  if (nameLower.includes(queryLower)) return 250;

  // Query is in description
  if (lowerDesc.includes(queryLower)) return 100;

  // Query words are all in name or description
  const queryWords = queryLower.split(/\s+/);
  const allWordsMatch = queryWords.every(
    (word) => nameLower.includes(word) || lowerDesc.includes(word),
  );
  if (allWordsMatch) return 50;

  return 0;
}
