import { getAppIcon } from "./icons.js";

// Normalize app name for comparison
export function normalizeAppName(name) {
  let normalized = name.toLowerCase();

  // Handle Flatpak reverse domain notation (com.valvesoftware.Steam -> steam)
  if (normalized.match(/^(com|org|io|net|app)\.[a-z0-9]+\./)) {
    // Extract the last component as the app name
    const parts = normalized.split(".");
    normalized = parts[parts.length - 1];
  }

  // Only remove common suffixes, NOT prefixes
  // This prevents python-mpv from being treated as mpv
  normalized = normalized.replace(
    /-bin$|-git$|-stable$|-beta$|-dev$|-desktop$/,
    "",
  );

  // Remove separators
  normalized = normalized.replace(/[._-]/g, "");

  return normalized.trim();
}

// Merge app from different sources into one unified entry
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
