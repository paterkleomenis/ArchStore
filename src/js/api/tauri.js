import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/**
 * Tauri API wrapper module
 * Provides a clean interface to all backend commands
 */

// ============================================================================
// Package Search Commands
// ============================================================================

/**
 * Search official Arch repositories
 */
export async function searchOfficialPackages(query) {
  return await invoke("search_official_packages", { query });
}

/**
 * Search AUR packages
 */
export async function searchAurPackages(query) {
  return await invoke("search_aur_packages", { query });
}

/**
 * Search Flatpak packages
 */
export async function searchFlatpakPackages(query) {
  return await invoke("search_flatpak_packages", { query });
}

// ============================================================================
// Package Installation/Removal Commands
// ============================================================================

/**
 * Install a package
 */
export async function installPackage(packageName, source, password) {
  return await invoke("install_package", {
    packageName,
    source,
    password,
  });
}

/**
 * Remove a package
 */
export async function removePackage(packageName, source, removeMode, password) {
  return await invoke("remove_package", {
    packageName,
    source,
    removeMode,
    password,
  });
}

// ============================================================================
// System Update Commands
// ============================================================================

/**
 * Check for system updates
 */
export async function checkUpdates() {
  return await invoke("check_updates");
}

/**
 * Update the entire system
 */
export async function updateSystem(password) {
  return await invoke("update_system", { password });
}

/**
 * Update only official packages
 */
export async function updateOfficial(password) {
  return await invoke("update_official", { password });
}

/**
 * Update only AUR packages
 */
export async function updateAur(password) {
  return await invoke("update_aur", { password });
}

/**
 * Update only Flatpak packages
 */
export async function updateFlatpak() {
  return await invoke("update_flatpak");
}

// ============================================================================
// Settings Commands
// ============================================================================

/**
 * Enable multilib repository
 */
export async function enableMultilib(password) {
  return await invoke("enable_multilib", { password });
}

/**
 * Check which package sources are available on the system
 */
export async function checkSystemCapabilities() {
  return await invoke("check_system_capabilities");
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Listen for install progress events
 */
export async function onInstallProgress(callback) {
  return await listen("install-progress", (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for remove progress events
 */
export async function onRemoveProgress(callback) {
  return await listen("remove-progress", (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for update progress events
 */
export async function onUpdateProgress(callback) {
  return await listen("update-progress", (event) => {
    callback(event.payload);
  });
}
