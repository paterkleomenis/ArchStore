import {
  searchOfficialPackages,
  searchAurPackages,
  searchFlatpakPackages,
  installPackage as tauriInstallPackage,
  removePackage as tauriRemovePackage,
} from "./tauri.js";

/**
 * High-level package operations API
 * Combines search across multiple sources and handles package operations
 */

/**
 * Search packages across all enabled sources
 * @param {string} query - Search query
 * @param {Object} settings - App settings (enableAur, enableFlatpak)
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<Array>} Array of packages from all sources
 */
export async function searchAllSources(query, settings, onProgress) {
  const results = [];
  const sources = [];

  // Determine which sources to search based on settings
  sources.push({
    name: "official",
    search: () => searchOfficialPackages(query),
  });

  if (settings.enableAur) {
    sources.push({
      name: "aur",
      search: () => searchAurPackages(query),
    });
  }

  if (settings.enableFlatpak) {
    sources.push({
      name: "flatpak",
      search: () => searchFlatpakPackages(query),
    });
  }

  // Search all sources in parallel
  const promises = sources.map(async (source) => {
    try {
      if (onProgress) {
        onProgress(`Searching ${source.name}...`);
      }
      const packages = await source.search();
      return { source: source.name, packages };
    } catch (error) {
      console.error(`Error searching ${source.name}:`, error);
      return { source: source.name, packages: [] };
    }
  });

  const sourceResults = await Promise.all(promises);

  // Combine results
  sourceResults.forEach(({ source, packages }) => {
    if (packages && packages.length > 0) {
      results.push(...packages);
    }
  });

  return results;
}

/**
 * Fetch detailed package information from specific sources
 * @param {Object} app - App object with sources
 * @returns {Promise<Object>} App data with populated package details
 */
export async function fetchPackageDetails(app) {
  const searches = [];
  const sourceNames = Object.keys(app.sources);

  for (const source of sourceNames) {
    const packageName = app.sources[source];

    if (source === "official") {
      searches.push(
        searchOfficialPackages(packageName)
          .then((results) => results.find((p) => p.name === packageName))
          .catch(() => null)
      );
    } else if (source === "aur") {
      searches.push(
        searchAurPackages(packageName)
          .then((results) => results.find((p) => p.name === packageName))
          .catch(() => null)
      );
    } else if (source === "flatpak") {
      // For Flatpak, search by app ID or name
      let searchQuery = packageName;
      if (!packageName.includes(".")) {
        // If not a reverse domain, search by name
        const parts = app.displayName.split(" ");
        searchQuery = parts[0];
      }

      searches.push(
        searchFlatpakPackages(searchQuery)
          .then((results) => {
            // Try exact match first (case-insensitive)
            const normalizedQuery = packageName.toLowerCase();
            let match = results.find(
              (p) => p.name.toLowerCase() === normalizedQuery
            );

            // If no exact match, try partial match on the query
            if (!match && results.length > 0) {
              const queryLower = searchQuery.toLowerCase();
              match = results.find(
                (p) =>
                  p.name.toLowerCase().includes(queryLower) ||
                  (p.description &&
                    p.description.toLowerCase().includes(queryLower))
              );
            }

            // Fallback to first result if still no match
            return match || results[0] || null;
          })
          .catch(() => null)
      );
    }
  }

  const results = await Promise.all(searches);

  // Build sources object with actual package data
  const realSources = {};
  sourceNames.forEach((sourceName, index) => {
    if (results[index]) {
      realSources[sourceName] = results[index];
    }
  });

  return {
    ...app,
    sources: realSources,
  };
}

/**
 * Install a package from a specific source
 * @param {string} packageName - Package name
 * @param {string} source - Source (official, aur, flatpak)
 * @param {string} password - User password (not needed for flatpak)
 */
export async function installPackage(packageName, source, password) {
  return await tauriInstallPackage(packageName, source, password);
}

/**
 * Remove a package from a specific source
 * @param {string} packageName - Package name
 * @param {string} source - Source (official, aur, flatpak)
 * @param {string} removeMode - Remove mode (package, dependencies, cascade)
 * @param {string} password - User password (not needed for flatpak)
 */
export async function removePackage(packageName, source, removeMode, password) {
  return await tauriRemovePackage(packageName, source, removeMode, password);
}
