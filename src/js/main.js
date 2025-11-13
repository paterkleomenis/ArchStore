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

  const updateAllBtn = document.getElementById("update-all-btn");
  if (updateAllBtn) {
    updateAllBtn.addEventListener("click", handleUpdateAll);
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

      let html = "";
      updates.forEach((update) => {
        const sourceClass = `source-${update.source}`;
        html += `
            <div style="padding: 8px; margin-bottom: 4px; background: var(--bg-primary); border-radius: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-weight: 500; color: var(--text-primary);">${escapeHtml(update.name)}</span>
                  <span class="source-badge ${sourceClass}" style="margin-left: 8px; font-size: 10px;">${update.source}</span>
                </div>
                <span style="font-size: 12px; color: var(--text-secondary);">${escapeHtml(update.version)}</span>
              </div>
              <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(update.description)}</div>
            </div>
          `;
      });
      updatesContainer.innerHTML = html;

      btn.textContent = `${updates.length} Updates Available`;
      btn.style.background = "var(--success)";
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

// Handle update all button
async function handleUpdateAll() {
  const btn = document.getElementById("update-all-btn");
  const { showPasswordPrompt } = await import("./ui/modal.js");
  const { showUpdateModal, addUpdateTerminalLine } = await import(
    "./ui/modal.js"
  );

  btn.textContent = "Updating...";
  btn.disabled = true;

  try {
    const password = await showPasswordPrompt();
    showUpdateModal();

    await invoke("update_system", { password });

    setTimeout(() => {
      closeSettings();
      setTimeout(() => {
        handleCheckUpdates();
      }, 1000);
    }, 2000);
  } catch (error) {
    if (error.message === "Password prompt cancelled") {
      console.log("Update cancelled by user");
      if (document.getElementById("update-modal")) {
        addUpdateTerminalLine("Update cancelled by user", "error");
      }
    } else {
      console.error("Failed to update system:", error);
      addUpdateTerminalLine("ERROR: " + error, "error");
    }
    btn.disabled = false;
    btn.textContent = "Update All Packages";
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
