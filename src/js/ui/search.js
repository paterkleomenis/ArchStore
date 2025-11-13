import { invoke } from "@tauri-apps/api/core";
import {
  allPackages,
  currentFilter,
  currentInstallFilter,
  currentSort,
  currentView,
  settings,
  setAllPackages,
  setCurrentView,
  escapeHtml,
} from "../main.js";
import { normalizeAppName, mergeAppSources } from "../utils/normalize.js";
import { getAppIcon } from "../utils/icons.js";
import { fetchAndShowAppDetail } from "./detail.js";

// Search packages with incremental results
export async function searchPackages(query) {
  showLoading("Searching official repositories...");

  // Reset packages
  setAllPackages([]);
  let rawPackages = [];
  const queryLower = query.toLowerCase();
  let sourcesCompleted = 0;
  let sourcesStarted = 0;
  const totalSources =
    1 + (settings.enableAur ? 1 : 0) + (settings.enableFlatpak ? 1 : 0);

  try {
    // Helper function to process and display results incrementally
    const processAndDisplay = (newPackages, sourceName = "") => {
      // Filter relevant packages
      const relevant = newPackages.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(queryLower) ||
          pkg.description.toLowerCase().includes(queryLower),
      );

      // Add to raw packages
      rawPackages.push(...relevant);

      // Group packages by normalized name
      const grouped = {};
      rawPackages.forEach((pkg) => {
        const normalized = normalizeAppName(pkg.name);
        if (!grouped[normalized]) {
          grouped[normalized] = [];
        }
        grouped[normalized].push(pkg);
      });

      // Merge grouped packages into unified entries
      let newAllPackages = [];
      for (const [normalizedName, packages] of Object.entries(grouped)) {
        if (packages.length === 1) {
          // Single package, keep as is
          newAllPackages.push(packages[0]);
        } else {
          // Multiple packages, merge them
          const baseName = packages[0].name.toLowerCase().replace(/[._-]/g, "");
          const merged = mergeAppSources(baseName, packages);
          if (merged) {
            // Convert merged app to package format for search results
            newAllPackages.push({
              name: merged.displayName,
              version: Object.keys(merged.sources)
                .map((s) => merged.sources[s].version)
                .join(", "),
              description: merged.description,
              source: "multiple",
              installed: Object.values(merged.sources).some((s) => s.installed),
              isMerged: true,
              mergedData: merged,
            });
          }
        }
      }

      // Sort packages
      newAllPackages.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();

        const aScore = getRelevanceScore(
          aName,
          queryLower,
          a.source,
          a.description,
        );
        const bScore = getRelevanceScore(
          bName,
          queryLower,
          b.source,
          b.description,
        );

        if (aScore !== bScore) return bScore - aScore;

        const sourceOrder = { official: 3, multiple: 3, flatpak: 2, aur: 1 };
        const aSourceScore = sourceOrder[a.source] || 0;
        const bSourceScore = sourceOrder[b.source] || 0;

        if (aSourceScore !== bSourceScore) return bSourceScore - aSourceScore;

        return a.name.localeCompare(b.name);
      });

      setAllPackages(newAllPackages);

      // Display results immediately with status
      const filtered = filterAndSortPackages(newAllPackages);
      renderPackages(filtered, sourcesCompleted < totalSources, sourceName);
    };

    // Search official packages first (usually fastest)
    sourcesStarted++;
    invoke("search_official_packages", { query })
      .then((packages) => {
        if (packages && packages.length > 0) {
          processAndDisplay(packages, "Official");
        }
        sourcesCompleted++;
        if (sourcesCompleted >= totalSources) {
          clearSearchStatus();
        }
      })
      .catch(() => {
        sourcesCompleted++;
        if (sourcesCompleted >= totalSources) {
          clearSearchStatus();
        }
      });

    // Search AUR if enabled
    if (settings.enableAur) {
      sourcesStarted++;
      setTimeout(() => {
        updateLoadingStatus("Searching AUR...");
        invoke("search_aur_packages", { query })
          .then((packages) => {
            if (packages && packages.length > 0) {
              // Limit AUR results to avoid overwhelming
              const limited = packages.slice(0, 20);
              processAndDisplay(limited, "AUR");
            }
            sourcesCompleted++;
            if (sourcesCompleted >= totalSources) {
              clearSearchStatus();
            }
          })
          .catch(() => {
            sourcesCompleted++;
            if (sourcesCompleted >= totalSources) {
              clearSearchStatus();
            }
          });
      }, 100);
    }

    // Search Flatpak if enabled
    if (settings.enableFlatpak) {
      sourcesStarted++;
      setTimeout(() => {
        updateLoadingStatus("Searching Flatpak...");
        invoke("search_flatpak_packages", { query })
          .then((packages) => {
            if (packages && packages.length > 0) {
              processAndDisplay(packages, "Flatpak");
            }
            sourcesCompleted++;
            if (sourcesCompleted >= totalSources) {
              clearSearchStatus();
            }
          })
          .catch(() => {
            sourcesCompleted++;
            if (sourcesCompleted >= totalSources) {
              clearSearchStatus();
            }
          });
      }, 200);
    }
  } catch (error) {
    showError("Search failed: " + error);
  }
}

// Get relevance score for sorting
function getRelevanceScore(lowerName, lowerQuery, source, description) {
  const lowerDesc = (description || "").toLowerCase();

  // Exact match on description display name (for Flatpak)
  if (source === "flatpak") {
    const displayName = lowerDesc.split(" - ")[0].toLowerCase();
    if (displayName === lowerQuery) return 1000;
    if (displayName.startsWith(lowerQuery)) return 800;
    if (displayName.includes(lowerQuery)) return 700;
  }

  if (lowerName === lowerQuery) return 1000;

  let cleanName = lowerName.replace(
    /^(lib|python-|python3-|nodejs-|node-|go-|rust-|perl-|ruby-|php-)/,
    "",
  );

  if (cleanName === lowerQuery) return 900;
  if (lowerName.startsWith(lowerQuery)) return 800;
  if (cleanName.startsWith(lowerQuery)) return 700;
  if (
    lowerName.includes("-" + lowerQuery + "-") ||
    lowerName.includes("-" + lowerQuery) ||
    lowerName.startsWith(lowerQuery + "-") ||
    lowerName.includes("." + lowerQuery + ".") ||
    lowerName.includes("." + lowerQuery) ||
    lowerName.endsWith("." + lowerQuery) ||
    lowerName.endsWith("-" + lowerQuery)
  )
    return 600;
  if (lowerName.includes(lowerQuery)) return 500;

  return 0;
}

// Filter and sort packages based on current filters
export function filterAndSortPackages(packages) {
  let filtered = [...packages];

  // Apply install status filter
  if (currentInstallFilter === "installed") {
    filtered = filtered.filter((pkg) => {
      if (pkg.isMerged && pkg.mergedData) {
        return Object.values(pkg.mergedData.sources).some((s) => s.installed);
      }
      return pkg.installed;
    });
  } else if (currentInstallFilter === "not-installed") {
    filtered = filtered.filter((pkg) => {
      if (pkg.isMerged && pkg.mergedData) {
        return !Object.values(pkg.mergedData.sources).some((s) => s.installed);
      }
      return !pkg.installed;
    });
  }

  // Apply source filter (from tabs)
  filtered = filterPackages(filtered);

  // Apply sorting
  if (currentSort === "name") {
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === "name-desc") {
    filtered.sort((a, b) => b.name.localeCompare(a.name));
  } else if (currentSort === "source") {
    const sourceOrder = { official: 0, multiple: 1, flatpak: 2, aur: 3 };
    filtered.sort((a, b) => {
      const aOrder = sourceOrder[a.source] || 999;
      const bOrder = sourceOrder[b.source] || 999;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.name.localeCompare(b.name);
    });
  }
  // currentSort === "relevance" uses the existing sorting from search

  return filtered;
}

// Filter packages by source
export function filterPackages(packages) {
  if (currentFilter === "all") return packages;

  return packages.filter((pkg) => {
    // For merged packages, check if the filtered source exists
    if (pkg.isMerged && pkg.mergedData) {
      return pkg.mergedData.sources.hasOwnProperty(currentFilter);
    }
    // For regular packages, match source directly
    return pkg.source === currentFilter;
  });
}

// Render packages (search results)
export function renderPackages(packages, searching = false, sourceName = "") {
  const container = document.getElementById("packages-container");

  if (packages.length === 0 && !searching) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No packages found</h3>
        <p>Try a different search term or filter</p>
      </div>
    `;
    return;
  }

  let html = "";

  // Show search status bar if still searching
  if (searching) {
    html += `
      <div class="search-status-bar">
        <div class="search-status-content">
          <div class="spinner-small"></div>
          <span>Searching remaining sources... ${packages.length} results so far</span>
        </div>
      </div>
    `;
  }

  // Show results header with count
  if (!searching && packages.length > 0) {
    html += `
      <div class="search-results-header">
        <div class="results-count">
          Found <strong>${packages.length}</strong> package${packages.length === 1 ? "" : "s"}
        </div>
      </div>
    `;
  }

  html += '<div class="packages-grid">';

  packages.slice(0, 50).forEach((pkg) => {
    html += createPackageCardHTML(pkg);
  });

  html += "</div>";

  container.innerHTML = html;

  // Re-attach event listeners
  attachPackageCardListeners();
}

// Create package card HTML
function createPackageCardHTML(pkg) {
  // Check if this is a merged app
  if (pkg.isMerged && pkg.mergedData) {
    const mergedData = pkg.mergedData;
    const sourceCount = Object.keys(mergedData.sources).length;
    const sourceBadges = Object.keys(mergedData.sources)
      .map((s) => `<span class="source-badge source-${s}">${s}</span>`)
      .join("");
    const isInstalled = Object.values(mergedData.sources).some(
      (s) => s.installed,
    );

    return `
      <div class="package-card clickable-card" data-merged='${JSON.stringify(mergedData).replace(/'/g, "&#39;")}'>
        <div class="package-header">
          <div>
            <div class="package-name">${escapeHtml(mergedData.displayName)}</div>
            <div class="app-sources">${sourceBadges}</div>
          </div>
        </div>
        <div class="package-description">${escapeHtml(mergedData.description || "No description")}</div>
        <div class="package-footer">
          <span class="package-version">${sourceCount} source${sourceCount > 1 ? "s" : ""} available</span>
          <div class="package-actions">
            <button class="view-details-btn">View Details</button>
          </div>
        </div>
      </div>
    `;
  }

  // Regular single-source package
  const sourceClass = `source-${pkg.source}`;
  const installed = pkg.installed;
  const pkgData = JSON.stringify(pkg).replace(/'/g, "&#39;");

  return `
    <div class="package-card clickable-card" data-package='${pkgData}'>
      <div class="package-header">
        <div>
          <div class="package-name">${escapeHtml(pkg.name)}</div>
          <span class="package-source ${sourceClass}">${pkg.source}</span>
        </div>
      </div>
      <div class="package-description">${escapeHtml(pkg.description || "No description")}</div>
      <div class="package-footer">
        <span class="package-version">${escapeHtml(pkg.version)}</span>
        <div class="package-actions">
          <button class="quick-install-btn" ${installed ? "disabled" : ""}>
            ${installed ? "✓ Installed" : "Install"}
          </button>
          <button class="view-details-btn">Details</button>
        </div>
      </div>
    </div>
  `;
}

// Attach event listeners to package cards
function attachPackageCardListeners() {
  document.querySelectorAll(".package-card").forEach((card) => {
    // Make entire card clickable to view details
    card.addEventListener("click", (e) => {
      // Don't trigger if clicking on a button
      if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
        return;
      }

      if (card.dataset.merged) {
        const mergedData = JSON.parse(card.dataset.merged);
        fetchAndShowAppDetail(mergedData);
      } else if (card.dataset.package) {
        const pkg = JSON.parse(card.dataset.package);
        // Convert single package to app format
        const appData = {
          name: pkg.name,
          displayName: pkg.name,
          description: pkg.description,
          sources: {
            [pkg.source]: pkg,
          },
          icon: getAppIcon(pkg.name),
        };
        fetchAndShowAppDetail(appData);
      }
    });

    const viewBtn = card.querySelector(".view-details-btn");
    if (viewBtn) {
      viewBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (card.dataset.merged) {
          const mergedData = JSON.parse(card.dataset.merged);
          fetchAndShowAppDetail(mergedData);
        } else if (card.dataset.package) {
          const pkg = JSON.parse(card.dataset.package);
          const appData = {
            name: pkg.name,
            displayName: pkg.name,
            description: pkg.description,
            sources: {
              [pkg.source]: pkg,
            },
            icon: getAppIcon(pkg.name),
          };
          fetchAndShowAppDetail(appData);
        }
      });
    }

    const installBtn = card.querySelector(".quick-install-btn");
    if (installBtn && !installBtn.disabled) {
      installBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const pkg = JSON.parse(card.dataset.package);
        const { installPackage } = await import("./detail.js");
        installPackage(pkg.name, pkg.source);
      });
    }
  });
}

// Show loading
function showLoading(message = "Searching packages...") {
  const container = document.getElementById("packages-container");
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p id="loading-status">${message}</p>
    </div>
  `;
}

function updateLoadingStatus(message) {
  const statusEl = document.getElementById("loading-status");
  if (statusEl) {
    statusEl.textContent = message;
  }
}

function clearSearchStatus() {
  const statusBar = document.querySelector(".search-status-bar");
  if (statusBar) {
    statusBar.remove();
  }
}

// Show error
function showError(message) {
  const container = document.getElementById("packages-container");
  container.innerHTML = `
    <div class="empty-state">
      <h3>Error</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}
