import {
  checkUpdates,
  updateSystem,
  updateOfficial,
  updateAur,
  updateFlatpak,
  enableMultilib,
  checkSystemCapabilities,
} from "./tauri.js";

/**
 * System-wide operations API
 * Handles system updates, configuration, and settings
 */

/**
 * Check for available system updates
 * @returns {Promise<Array>} Array of available updates
 */
export async function checkForUpdates() {
  return await checkUpdates();
}

/**
 * Update the entire system (pacman -Syu, yay -Syu, flatpak update)
 * @param {string} password - User password for sudo operations
 */
export async function performSystemUpdate(password) {
  return await updateSystem(password);
}

/**
 * Update only official packages (pacman -Syu)
 * @param {string} password - User password for sudo operations
 */
export async function performOfficialUpdate(password) {
  return await updateOfficial(password);
}

/**
 * Update only AUR packages (yay/paru -Sua)
 * @param {string} password - User password for sudo operations
 */
export async function performAurUpdate(password) {
  return await updateAur(password);
}

/**
 * Update only Flatpak packages (flatpak update)
 */
export async function performFlatpakUpdate() {
  return await updateFlatpak();
}

/**
 * Enable multilib repository in pacman.conf
 * @param {string} password - User password for sudo operations
 */
export async function enableMultilibRepository(password) {
  return await enableMultilib(password);
}

/**
 * Check which package sources are available on the system
 * @returns {Promise<Object>} Object with has_aur_helper, has_flatpak, multilib_enabled
 */
export async function getSystemCapabilities() {
  return await checkSystemCapabilities();
}

/**
 * Settings storage key
 */
const SETTINGS_KEY = "archstore_settings";

/**
 * Load settings from localStorage
 * @returns {Object} Settings object
 */
export function loadSettings() {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to parse settings:", e);
    }
  }

  // Default settings
  return {
    enableAur: true,
    enableFlatpak: true,
    enableMultilib: false,
  };
}

/**
 * Save settings to localStorage
 * @param {Object} settings - Settings object
 */
export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
