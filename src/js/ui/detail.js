import { invoke } from "@tauri-apps/api/core";
import { getAppIcon } from "../utils/icons.js";
import { normalizeAppName } from "../utils/normalize.js";
import {
  escapeHtml,
  currentView,
  currentApp,
  settings,
  setCurrentView,
  setCurrentApp,
} from "../main.js";
import { showPasswordPrompt } from "./modal.js";

// Fetch app detail data without showing loading UI
export async function fetchAppDetailData(app) {
  try {
    // Search for the app in all enabled sources
    const searches = [];
    const sourceNames = Object.keys(app.sources);

    for (const source of sourceNames) {
      // Handle both string package names and package objects
      const packageName =
        typeof app.sources[source] === "string"
          ? app.sources[source]
          : app.sources[source].name;

      if (source === "official") {
        searches.push(
          invoke("search_official_packages", { query: packageName })
            .then((results) => results.find((p) => p.name === packageName))
            .catch(() => null),
        );
      } else if (source === "aur" && settings.enableAur) {
        searches.push(
          invoke("search_aur_packages", { query: packageName })
            .then((results) => results.find((p) => p.name === packageName))
            .catch(() => null),
        );
      } else if (source === "flatpak" && settings.enableFlatpak) {
        // For Flatpak, try to get better search results
        // If packageName is a full app ID, extract the last component for search
        let searchQuery = packageName;
        if (packageName.match(/^(com|org|io|net|app)\./)) {
          // It's a full app ID, extract last part for better search results
          const parts = packageName.split(".");
          searchQuery = parts[parts.length - 1];
        }

        console.log(
          `[Flatpak Refresh] Searching for: "${searchQuery}" (original: "${packageName}")`,
        );

        searches.push(
          invoke("search_flatpak_packages", { query: searchQuery })
            .then((results) => {
              console.log(
                `[Flatpak Refresh] Got ${results.length} results for "${searchQuery}"`,
              );
              if (results.length > 0) {
                console.log("[Flatpak Refresh] First result:", results[0]);
              }

              // Try exact match first (case-insensitive)
              let match = results.find(
                (p) => p.name.toLowerCase() === packageName.toLowerCase(),
              );

              if (match) {
                console.log("[Flatpak Refresh] Found exact match:", match.name);
                return match;
              }

              // If no exact match, try normalized name matching
              const normalizedQuery = normalizeAppName(packageName);
              match = results.find((p) => {
                const normalizedResult = normalizeAppName(p.name);
                return normalizedResult === normalizedQuery;
              });

              if (match) {
                console.log(
                  "[Flatpak Refresh] Found normalized match:",
                  match.name,
                );
                return match;
              }

              // Try substring matching as last resort
              const queryLower = packageName.toLowerCase();
              match = results.find(
                (p) =>
                  p.name.toLowerCase().includes(queryLower) ||
                  queryLower.includes(p.name.toLowerCase()),
              );

              if (match) {
                console.log(
                  "[Flatpak Refresh] Found substring match:",
                  match.name,
                );
              } else {
                console.log(
                  "[Flatpak Refresh] No match found for",
                  packageName,
                );
              }

              return match || null;
            })
            .catch((err) => {
              console.error("[Flatpak Refresh] Error searching:", err);
              return null;
            }),
        );
      }
    }

    const results = await Promise.all(searches);
    const realSources = {};

    console.log("[Refresh] Search results for", app.displayName || app.name);
    sourceNames.forEach((source, index) => {
      console.log(
        `[Refresh] Source ${source}:`,
        results[index] ? "Found" : "Not found",
      );
      if (results[index]) {
        realSources[source] = results[index];
        console.log(
          `[Refresh] ${source} package:`,
          results[index].name,
          results[index].version,
          "installed:",
          results[index].installed,
        );
      } else {
        // Preserve original source data if refresh doesn't find it
        console.log(
          `[Refresh] Preserving original ${source} data (search returned no results)`,
        );
        realSources[source] = app.sources[source];
      }
    });

    console.log("[Refresh] Final realSources keys:", Object.keys(realSources));

    // Build merged app data with real package info
    return {
      ...app,
      sources: realSources,
    };
  } catch (error) {
    console.error("Failed to fetch app details:", error);
    return app; // Fallback to original data
  }
}

export async function fetchAndShowAppDetail(app) {
  const container = document.getElementById("packages-container");

  // Show loading
  container.innerHTML = `
    <div class="app-detail-view">
      <button class="back-btn" onclick="location.reload()">← Back</button>
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading ${app.displayName} details...</p>
      </div>
    </div>
  `;

  const mergedApp = await fetchAppDetailData(app);
  showAppDetail(mergedApp);
}

// Show app detail view
export function showAppDetail(app) {
  setCurrentView("detail");
  setCurrentApp(app);
  const container = document.getElementById("packages-container");

  let html = `
    <div class="app-detail-view">
      <div class="app-detail-actions">
        <button class="back-btn" id="back-btn">← Back</button>
        <button class="refresh-btn" id="refresh-btn">↻ Refresh</button>
      </div>

      <div class="app-detail-header">
        <div class="app-detail-icon">
          <img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.name)}" onerror="this.src='https://via.placeholder.com/128?text=${app.name[0].toUpperCase()}'">
        </div>
        <div class="app-detail-info">
          <h1 class="app-detail-name">${escapeHtml(app.displayName)}</h1>
          <p class="app-detail-description">${escapeHtml(app.description || "No description available")}</p>
        </div>
      </div>

      <div class="app-detail-sources">
        <h2>Available Sources</h2>
        <p class="sources-hint">Choose where to install this application from:</p>
        <div class="sources-grid">
  `;

  Object.entries(app.sources).forEach(([source, pkg]) => {
    html += `
      <div class="source-option">
        <div class="source-option-header">
          <span class="source-badge-large source-${source}">${source.toUpperCase()}</span>
          <span class="source-version">${escapeHtml(pkg.version)}</span>
        </div>
        <div class="source-option-details">
          <p class="source-package-name">${escapeHtml(pkg.name)}</p>
          ${pkg.installed ? '<span class="installed-badge">✓ Installed</span>' : ""}
        </div>
        <div class="source-option-buttons">
          <button class="install-from-source-btn" data-package-name="${escapeHtml(pkg.name)}" data-source="${source}" ${pkg.installed ? "disabled" : ""}>
            ${pkg.installed ? "Installed" : "Install from " + source.toUpperCase()}
          </button>
          ${pkg.installed ? `<button class="remove-from-source-btn" data-package-name="${escapeHtml(pkg.name)}" data-source="${source}">Remove</button>` : ""}
        </div>
      </div>
    `;
  });

  html += `
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Add event listeners
  document.getElementById("back-btn").addEventListener("click", () => {
    if (currentView === "detail") {
      const { returnToHome } = require("./home.js");
      returnToHome();
    }
  });

  document.getElementById("refresh-btn").addEventListener("click", () => {
    if (currentView === "detail" && currentApp) {
      fetchAndShowAppDetail(currentApp);
    }
  });

  document.querySelectorAll(".install-from-source-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const packageName = e.target.dataset.packageName;
      const source = e.target.dataset.source;
      installPackage(packageName, source);
    });
  });

  document.querySelectorAll(".remove-from-source-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const packageName = e.target.dataset.packageName;
      const source = e.target.dataset.source;
      showRemoveOptionsModal(packageName, source);
    });
  });
}

// Install package
export async function installPackage(name, source) {
  try {
    // Prompt for password first (only for official and AUR, not flatpak)
    let password = "";
    if (source !== "flatpak") {
      password = await showPasswordPrompt();
    }

    const { showModal } = await import("./modal.js");
    showModal(name);

    await invoke("install_package", {
      packageName: name,
      source,
      password,
    });
  } catch (error) {
    if (error.message === "Password prompt cancelled") {
      const { addTerminalLine } = await import("./modal.js");
      addTerminalLine("Installation cancelled by user", "error");
    } else {
      const { addTerminalLine } = await import("./modal.js");
      addTerminalLine("ERROR: " + error, "error");
    }
  }
}

// Show remove options modal
function showRemoveOptionsModal(packageName, source) {
  if (source === "flatpak") {
    // Flatpak doesn't need options, just remove directly
    removePackage(packageName, source, "normal");
    return;
  }

  // For official and AUR, show options modal
  const modal = document.createElement("div");
  modal.className = "modal active";
  modal.id = "remove-options-modal";
  modal.innerHTML = `
    <div class="remove-options-modal-content">
      <div class="remove-modal-header">
        <h2>Remove ${escapeHtml(packageName)}</h2>
        <p class="remove-modal-subtitle">Choose how to remove this package</p>
      </div>

      <div class="remove-options-container">
        <button class="remove-option-btn" data-mode="simple">
          <div class="remove-option-title">
            Just Remove Package
          </div>
          <div class="remove-option-desc">
            Uses <code>pacman -R</code> to remove only this package while keeping its dependencies installed
          </div>
        </button>

        <button class="remove-option-btn" data-mode="recursive">
          <div class="remove-option-title">
            Remove Everything
            <span class="remove-option-badge">Recommended</span>
          </div>
          <div class="remove-option-desc">
            Uses <code>pacman -Rns</code> to remove the package, its unused dependencies, and configuration files
          </div>
        </button>
      </div>

      <div class="remove-modal-footer">
        <button class="cancel-remove-btn">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add click handlers
  modal.querySelectorAll(".remove-option-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      document.body.removeChild(modal);
      removePackage(packageName, source, mode);
    });
  });

  modal.querySelector(".cancel-remove-btn").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // Close on background click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// Remove package
async function removePackage(name, source, mode) {
  try {
    // Prompt for password first (only for official and AUR, not flatpak)
    let password = "";
    if (source !== "flatpak") {
      password = await showPasswordPrompt();
    }

    const { showRemoveModal } = await import("./modal.js");
    showRemoveModal(name);

    await invoke("remove_package", {
      packageName: name,
      source,
      removeMode: mode,
      password,
    });

    // Refresh the app detail view after successful removal
    setTimeout(() => {
      if (currentView === "detail" && currentApp) {
        fetchAndShowAppDetail(currentApp);
      }
    }, 2500);
  } catch (error) {
    if (error.message === "Password prompt cancelled") {
      const { addRemoveTerminalLine } = await import("./modal.js");
      addRemoveTerminalLine("Removal cancelled by user", "error");
    } else {
      const { addRemoveTerminalLine } = await import("./modal.js");
      addRemoveTerminalLine("ERROR: " + error, "error");
    }
  }
}
