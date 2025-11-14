import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { showHomeScreen, returnToHome } from "./ui/home.js";
import {
  searchPackages,
  filterAndSortPackages,
  renderPackages,
} from "./ui/search.js";
import {
  openSettings,
  closeSettings,
  saveSettings,
  handleMultilibToggle,
} from "./ui/settings.js";

// Global state
export let allPackages = [];
export let currentFilter = "all";
export let currentInstallFilter = "all"; // "all", "installed", "not-installed"
export let currentSort = "relevance"; // "relevance", "name", "name-desc", "source"
export let currentCategory = "all";
export let searchTimeout = null;
export let currentView = "home"; // "home", "search", "detail"
export let currentApp = null;
export let pendingRefreshData = null;
export let lastUpdateCheck = null;
export let updateCheckInterval = null;

// Settings
export let settings = {
  enableAur: true,
  enableFlatpak: true,
  enableMultilib: false,
};

// Export setters for state
export function setAllPackages(packages) {
  allPackages = packages;
}

export function setCurrentFilter(filter) {
  currentFilter = filter;
}

export function setCurrentInstallFilter(filter) {
  currentInstallFilter = filter;
}

export function setCurrentSort(sort) {
  currentSort = sort;
}

export function setCurrentCategory(category) {
  currentCategory = category;
}

export function setSearchTimeout(timeout) {
  searchTimeout = timeout;
}

export function setCurrentView(view) {
  currentView = view;
}

export function setCurrentApp(app) {
  currentApp = app;
}

export function setSettings(newSettings) {
  settings = { ...settings, ...newSettings };
}

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
  loadSettings();
  setupEventListeners();
  showHomeScreen();
  setupInstallListener();
  setupRemoveListener();
  setupUpdateListener();
  setupUpdateChecker();
});

// Load settings from localStorage
function loadSettings() {
  const saved = localStorage.getItem("archstore-settings");
  if (saved) {
    settings = { ...settings, ...JSON.parse(saved) };
  }
  updateSettingsUI();
}

// Update settings UI checkboxes
function updateSettingsUI() {
  const aurCheckbox = document.getElementById("enable-aur");
  const flatpakCheckbox = document.getElementById("enable-flatpak");
  const multilibCheckbox = document.getElementById("enable-multilib");

  if (aurCheckbox) aurCheckbox.checked = settings.enableAur;
  if (flatpakCheckbox) flatpakCheckbox.checked = settings.enableFlatpak;
  if (multilibCheckbox) multilibCheckbox.checked = settings.enableMultilib;
}

export { updateSettingsUI };

// Event listeners
function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", handleSearch);

  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", handleFilterChange);
  });

  const closeBtn = document.getElementById("close-modal");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeModal);
  }

  const settingsBtn = document.getElementById("settings-btn");
  settingsBtn.addEventListener("click", openSettings);

  const closeSettingsBtn = document.getElementById("close-settings-modal");
  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener("click", closeSettings);
  }

  const saveSettingsBtn = document.getElementById("save-settings");
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", saveSettings);
  }

  const multilibCheckbox = document.getElementById("enable-multilib");
  if (multilibCheckbox) {
    multilibCheckbox.addEventListener("change", handleMultilibToggle);
  }

  const logo = document.querySelector(".logo");
  if (logo) {
    logo.addEventListener("click", returnToHome);
    logo.style.cursor = "pointer";
  }

  // Filter and Sort dropdowns
  const filterBtn = document.getElementById("filter-btn");
  const sortBtn = document.getElementById("sort-btn");
  const filterDropdown = document.getElementById("filter-dropdown");
  const sortDropdown = document.getElementById("sort-dropdown");

  if (filterBtn && filterDropdown) {
    filterBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      filterDropdown.classList.toggle("active");
      if (sortDropdown) sortDropdown.classList.remove("active");
    });
  }

  if (sortBtn && sortDropdown) {
    sortBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      sortDropdown.classList.toggle("active");
      if (filterDropdown) filterDropdown.classList.remove("active");
    });
  }

  // Close dropdowns when clicking outside
  document.addEventListener("click", () => {
    if (filterDropdown) filterDropdown.classList.remove("active");
    if (sortDropdown) sortDropdown.classList.remove("active");
  });

  // Filter options
  document
    .querySelectorAll("#filter-dropdown .dropdown-option")
    .forEach((option) => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const filter = option.dataset.filter;
        currentInstallFilter = filter;

        document
          .querySelectorAll("#filter-dropdown .dropdown-option")
          .forEach((opt) => {
            opt.classList.remove("selected");
          });
        option.classList.add("selected");

        if (filterDropdown) filterDropdown.classList.remove("active");
        if (currentView === "search") {
          const filtered = filterAndSortPackages(allPackages);
          renderPackages(filtered);
        }
      });
    });

  // Sort options
  document
    .querySelectorAll("#sort-dropdown .dropdown-option")
    .forEach((option) => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const sort = option.dataset.sort;
        currentSort = sort;

        document
          .querySelectorAll("#sort-dropdown .dropdown-option")
          .forEach((opt) => {
            opt.classList.remove("selected");
          });
        option.classList.add("selected");

        if (sortDropdown) sortDropdown.classList.remove("active");
        if (currentView === "search") {
          const filtered = filterAndSortPackages(allPackages);
          renderPackages(filtered);
        }
      });
    });

  // Update check button
  const checkUpdatesBtn = document.getElementById("check-updates-btn");
  if (checkUpdatesBtn) {
    checkUpdatesBtn.addEventListener("click", handleCheckUpdates);
  }

  // Check All/Uncheck All toggle
  const checkAllBtn = document.getElementById("check-all-updates");
  if (checkAllBtn) {
    checkAllBtn.addEventListener("click", handleCheckAllToggle);
  }

  // Update Selected button
  const updateSelectedBtn = document.getElementById("update-selected-btn");
  if (updateSelectedBtn) {
    updateSelectedBtn.addEventListener("click", handleUpdateSelected);
  }
}

// Handle check updates button
async function handleCheckUpdates() {
  const btn = document.getElementById("check-updates-btn");
  const updatesList = document.getElementById("updates-list");
  const updatesContainer = document.getElementById("updates-container");
  const updatesCount = document.getElementById("updates-count");

  btn.textContent = "Checking...";
  btn.disabled = true;

  try {
    const updates = await checkForUpdates();

    if (updates && updates.length > 0) {
      updatesCount.textContent = updates.length;
      updatesList.style.display = "block";

      // Group updates by source for better organization
      const officialUpdates = updates.filter((u) => u.source === "official");
      const aurUpdates = updates.filter((u) => u.source === "aur");
      const flatpakUpdates = updates.filter((u) => u.source === "flatpak");

      // Build HTML with checkboxes for each package
      let html = "";

      // Helper function to create package rows
      const createPackageRow = (update, index) => {
        const sourceClass = `source-${update.source}`;
        return `
          <label style="
            display: flex;
            align-items: center;
            padding: 8px;
            margin-bottom: 4px;
            background: var(--bg-primary);
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
          " class="update-package-item">
            <input
              type="checkbox"
              class="update-package-checkbox"
              data-package-name="${escapeHtml(update.name)}"
              data-package-source="${update.source}"
              data-package-version="${escapeHtml(update.version)}"
              checked
              style="width: 18px; height: 18px; margin-right: 12px; cursor: pointer;"
            />
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(update.name)}</span>
                  <span class="source-badge ${sourceClass}" style="font-size: 10px;">${update.source}</span>
                </div>
                <span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(update.version)}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary);">${escapeHtml(update.description)}</div>
            </div>
          </label>
        `;
      };

      // Official packages section
      if (officialUpdates.length > 0) {
        html += `
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">
              Official Repositories (${officialUpdates.length})
            </div>
        `;
        officialUpdates.forEach((update, index) => {
          html += createPackageRow(update, index);
        });
        html += `</div>`;
      }

      // AUR packages section
      if (aurUpdates.length > 0) {
        html += `
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">
              AUR (${aurUpdates.length})
            </div>
        `;
        aurUpdates.forEach((update, index) => {
          html += createPackageRow(update, index);
        });
        html += `</div>`;
      }

      // Flatpak packages section
      if (flatpakUpdates.length > 0) {
        html += `
          <div style="margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text-secondary); margin-bottom: 8px; text-transform: uppercase;">
              Flatpak (${flatpakUpdates.length})
            </div>
        `;
        flatpakUpdates.forEach((update, index) => {
          html += createPackageRow(update, index);
        });
        html += `</div>`;
      }

      updatesContainer.innerHTML = html;

      // Add change listeners to all checkboxes
      const checkboxes = updatesContainer.querySelectorAll(
        ".update-package-checkbox",
      );
      checkboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", updateCheckAllButtonText);
      });

      btn.textContent = `${updates.length} Updates Available`;
      btn.style.background = "var(--success)";

      // Update Check All button text
      updateCheckAllButtonText();
    } else {
      updatesList.style.display = "none";
      btn.textContent = "System is Up to Date";
      btn.style.background = "var(--success)";
      setTimeout(() => {
        btn.textContent = "Check for Updates";
        btn.style.background = "var(--accent)";
      }, 3000);
    }
  } catch (error) {
    console.error("Failed to check updates:", error);
    btn.textContent = "Check Failed - Try Again";
    btn.style.background = "var(--error)";
    setTimeout(() => {
      btn.textContent = "Check for Updates";
      btn.style.background = "var(--accent)";
    }, 3000);
  } finally {
    btn.disabled = false;
  }
}

// Update the Check All button text based on checkbox states
function updateCheckAllButtonText() {
  const btn = document.getElementById("check-all-updates");
  if (!btn) return;

  const checkboxes = document.querySelectorAll(".update-package-checkbox");
  if (checkboxes.length === 0) {
    btn.textContent = "Check All";
    return;
  }

  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);
  btn.textContent = allChecked ? "Uncheck All" : "Check All";

  // Update selected count
  const selectedCount = Array.from(checkboxes).filter(
    (cb) => cb.checked,
  ).length;
  const selectedCountNumber = document.getElementById("selected-count-number");
  if (selectedCountNumber) {
    selectedCountNumber.textContent = selectedCount;
  }
}

// Handle Check All / Uncheck All toggle
function handleCheckAllToggle() {
  const checkboxes = document.querySelectorAll(".update-package-checkbox");
  if (checkboxes.length === 0) return;

  const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

  // Toggle all checkboxes
  checkboxes.forEach((checkbox) => {
    checkbox.checked = !allChecked;
  });

  // Update button text
  updateCheckAllButtonText();
}

// Handle update selected packages
async function handleUpdateSelected() {
  console.log("[Update] handleUpdateSelected called");
  const btn = document.getElementById("update-selected-btn");
  const { showPasswordPrompt } = await import("./ui/modal.js");
  const { showUpdateModal, addUpdateTerminalLine } = await import(
    "./ui/modal.js"
  );

  // Get all checked packages
  const checkboxes = document.querySelectorAll(
    ".update-package-checkbox:checked",
  );
  console.log(`[Update] Found ${checkboxes.length} checked packages`);

  if (checkboxes.length === 0) {
    alert("Please select at least one package to update");
    return;
  }

  // Group selected packages by source
  const selectedPackages = {
    official: [],
    aur: [],
    flatpak: [],
  };

  checkboxes.forEach((checkbox) => {
    const packageName = checkbox.dataset.packageName;
    const source = checkbox.dataset.packageSource;
    selectedPackages[source].push(packageName);
  });

  const totalPackages = checkboxes.length;
  console.log("[Update] Selected packages:", selectedPackages);

  btn.textContent = "Updating...";
  btn.disabled = true;

  try {
    let password = null;

    // Get password if needed (for official or AUR)
    if (
      selectedPackages.official.length > 0 ||
      selectedPackages.aur.length > 0
    ) {
      console.log("[Update] Prompting for password...");
      password = await showPasswordPrompt();
      console.log("[Update] Password received, length:", password.length);
    }

    // Force remove ALL modals first
    console.log("[Update] Force removing all modals...");

    // Remove password modal
    const passwordModals = document.querySelectorAll("#password-prompt-modal");
    passwordModals.forEach((pm) => {
      console.log("[Update] Removing password modal");
      pm.remove();
    });

    // Add visual debug indicator
    let debugDiv = document.createElement("div");
    debugDiv.id = "update-debug-indicator";
    debugDiv.style.position = "fixed";
    debugDiv.style.top = "50%";
    debugDiv.style.left = "50%";
    debugDiv.style.transform = "translate(-50%, -50%)";
    debugDiv.style.padding = "40px 60px";
    debugDiv.style.background = "#1793d1";
    debugDiv.style.color = "white";
    debugDiv.style.fontSize = "24px";
    debugDiv.style.fontWeight = "bold";
    debugDiv.style.borderRadius = "12px";
    debugDiv.style.zIndex = "99998";
    debugDiv.style.boxShadow = "0 20px 60px rgba(0,0,0,0.8)";
    debugDiv.textContent = "Preparing Terminal...";
    document.body.appendChild(debugDiv);

    // Close settings modal
    const settingsModal = document.getElementById("settings-modal");
    if (settingsModal) {
      console.log("[Update] Closing settings modal");
      settingsModal.classList.remove("active");
    }

    // Remove any stray modals with "modal active" class
    const activeModals = document.querySelectorAll(".modal.active");
    activeModals.forEach((m) => {
      if (m.id !== "update-modal") {
        console.log("[Update] Removing active modal:", m.id);
        m.classList.remove("active");
        m.remove();
      }
    });

    // Longer delay to ensure all modals are gone
    console.log("[Update] Waiting for modals to clear...");
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Show terminal modal
    console.log("[Update] Showing terminal modal...");

    // Remove debug indicator
    debugDiv = document.getElementById("update-debug-indicator");
    if (debugDiv) {
      debugDiv.remove();
    }

    showUpdateModal(`Updating ${totalPackages} Package(s)`);
    console.log("[Update] Terminal modal shown, adding summary...");

    // Add selected packages summary
    addUpdateTerminalLine(
      `:: Selected ${totalPackages} package(s) for update:`,
      "normal",
    );
    if (selectedPackages.official.length > 0) {
      addUpdateTerminalLine(
        `   - Official: ${selectedPackages.official.length} package(s)`,
        "normal",
      );
    }
    if (selectedPackages.aur.length > 0) {
      addUpdateTerminalLine(
        `   - AUR: ${selectedPackages.aur.length} package(s)`,
        "normal",
      );
    }
    if (selectedPackages.flatpak.length > 0) {
      addUpdateTerminalLine(
        `   - Flatpak: ${selectedPackages.flatpak.length} package(s)`,
        "normal",
      );
    }
    addUpdateTerminalLine("", "normal");

    let completedCount = 0;

    // Update official packages
    if (selectedPackages.official.length > 0) {
      addUpdateTerminalLine(
        `:: Updating ${selectedPackages.official.length} official package(s)...`,
        "normal",
      );
      addUpdateTerminalLine("", "normal");

      for (const pkgName of selectedPackages.official) {
        completedCount++;
        addUpdateTerminalLine(
          `[${completedCount}/${totalPackages}] Updating ${pkgName} from official repositories...`,
          "normal",
        );

        try {
          await invoke("install_package", {
            packageName: pkgName,
            source: "official",
            password: password,
          });
          addUpdateTerminalLine(`✓ Successfully updated ${pkgName}`, "normal");
        } catch (err) {
          addUpdateTerminalLine(
            `✗ Failed to update ${pkgName}: ${err}`,
            "error",
          );
        }
        addUpdateTerminalLine("", "normal");
      }
    }

    // Update AUR packages
    if (selectedPackages.aur.length > 0) {
      addUpdateTerminalLine(
        `:: Updating ${selectedPackages.aur.length} AUR package(s)...`,
        "normal",
      );
      addUpdateTerminalLine("", "normal");

      for (const pkgName of selectedPackages.aur) {
        completedCount++;
        addUpdateTerminalLine(
          `[${completedCount}/${totalPackages}] Updating ${pkgName} from AUR...`,
          "normal",
        );

        try {
          await invoke("install_package", {
            packageName: pkgName,
            source: "aur",
            password: password,
          });
          addUpdateTerminalLine(`✓ Successfully updated ${pkgName}`, "normal");
        } catch (err) {
          addUpdateTerminalLine(
            `✗ Failed to update ${pkgName}: ${err}`,
            "error",
          );
        }
        addUpdateTerminalLine("", "normal");
      }
    }

    // Update Flatpak packages
    if (selectedPackages.flatpak.length > 0) {
      addUpdateTerminalLine(
        `:: Updating ${selectedPackages.flatpak.length} Flatpak package(s)...`,
        "normal",
      );
      addUpdateTerminalLine("", "normal");

      for (const pkgName of selectedPackages.flatpak) {
        completedCount++;
        addUpdateTerminalLine(
          `[${completedCount}/${totalPackages}] Updating ${pkgName} from Flatpak...`,
          "normal",
        );

        try {
          await invoke("install_package", {
            packageName: pkgName,
            source: "flatpak",
            password: "",
          });
          addUpdateTerminalLine(`✓ Successfully updated ${pkgName}`, "normal");
        } catch (err) {
          addUpdateTerminalLine(
            `✗ Failed to update ${pkgName}: ${err}`,
            "error",
          );
        }
        addUpdateTerminalLine("", "normal");
      }
    }

    addUpdateTerminalLine("=".repeat(60), "normal");
    addUpdateTerminalLine(
      `:: Update complete! ${totalPackages} package(s) processed.`,
      "normal",
    );
    addUpdateTerminalLine("=".repeat(60), "normal");

    setTimeout(() => {
      const modal = document.getElementById("update-modal");
      if (modal) {
        modal.classList.remove("active");
      }
      // Re-open settings and refresh updates
      const settingsModal = document.getElementById("settings-modal");
      if (settingsModal) {
        settingsModal.classList.add("active");
      }
      setTimeout(() => {
        handleCheckUpdates();
      }, 500);
    }, 3000);
  } catch (error) {
    if (error.message === "Password prompt cancelled") {
      console.log("Update cancelled by user");
      addUpdateTerminalLine("", "normal");
      addUpdateTerminalLine("=".repeat(60), "error");
      addUpdateTerminalLine(":: Update cancelled by user", "error");
      addUpdateTerminalLine("=".repeat(60), "error");
    } else {
      console.error("Failed to update:", error);
      addUpdateTerminalLine("", "normal");
      addUpdateTerminalLine("=".repeat(60), "error");
      addUpdateTerminalLine(`:: ERROR: ${error}`, "error");
      addUpdateTerminalLine("=".repeat(60), "error");
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "Update Selected";
  }
}

// Search handler
function handleSearch(e) {
  const query = e.target.value.trim();

  clearTimeout(searchTimeout);

  if (query.length < 2) {
    currentView = "home";
    showHomeScreen();
    return;
  }

  currentView = "search";
  searchTimeout = setTimeout(async () => {
    await searchPackages(query);
  }, 500);
}

// Filter change handler
function handleFilterChange(e) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  e.target.classList.add("active");

  currentFilter = e.target.dataset.source;

  const { filterPackages } = require("./ui/search.js");
  renderPackages(filterPackages(allPackages));
}

// Setup install progress listener
async function setupInstallListener() {
  const { updateProgress } = await import("./ui/modal.js");
  await listen("install-progress", (event) => {
    const progress = event.payload;
    updateProgress(progress);
  });
}

// Setup remove progress listener
async function setupRemoveListener() {
  const { updateRemoveProgress } = await import("./ui/modal.js");
  await listen("remove-progress", (event) => {
    const progress = event.payload;
    updateRemoveProgress(progress);
  });
}

// Setup update progress listener
async function setupUpdateListener() {
  const { updateUpdateProgress } = await import("./ui/modal.js");
  await listen("update-progress", (event) => {
    const progress = event.payload;
    updateUpdateProgress(progress);
  });
}

// Setup update checker (every 12 hours)
async function setupUpdateChecker() {
  await checkForUpdates();

  updateCheckInterval = setInterval(
    async () => {
      await checkForUpdates();
    },
    12 * 60 * 60 * 1000,
  );
}

// Check for system updates
async function checkForUpdates() {
  try {
    console.log("[Update Check] Checking for updates...");
    lastUpdateCheck = new Date();

    const updates = await invoke("check_updates");

    if (updates && updates.length > 0) {
      console.log(`[Update Check] Found ${updates.length} updates`);
      showUpdateNotification(updates.length);
    } else {
      console.log("[Update Check] System is up to date");
    }

    return updates;
  } catch (error) {
    console.error("[Update Check] Failed:", error);
    return [];
  }
}

// Show update notification badge
function showUpdateNotification(count) {
  const settingsBtn = document.getElementById("settings-btn");

  const existingBadge = settingsBtn.querySelector(".update-badge");
  if (existingBadge) {
    existingBadge.remove();
  }

  const badge = document.createElement("span");
  badge.className = "update-badge";
  badge.textContent = count;
  settingsBtn.style.position = "relative";
  settingsBtn.appendChild(badge);
}

// Close modal
function closeModal() {
  const modal = document.getElementById("install-modal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// Escape HTML
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
