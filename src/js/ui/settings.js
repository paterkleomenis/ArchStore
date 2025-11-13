import { invoke } from "@tauri-apps/api/core";
import { settings, setSettings, updateSettingsUI } from "../main.js";
import { showPasswordPrompt } from "./modal.js";
import { searchPackages } from "./search.js";
import { showHomeScreen } from "./home.js";

// Open settings modal
export function openSettings() {
  updateSettingsUI();
  const passwordPrompt = document.getElementById("multilib-password-prompt");
  const passwordInput = document.getElementById("sudo-password");
  const passwordError = document.getElementById("password-error");

  if (passwordPrompt) passwordPrompt.style.display = "none";
  if (passwordInput) passwordInput.value = "";
  if (passwordError) passwordError.style.display = "none";

  const modal = document.getElementById("settings-modal");
  modal.classList.add("active");
}

// Close settings modal
export function closeSettings() {
  const modal = document.getElementById("settings-modal");
  modal.classList.remove("active");
}

// Handle multilib toggle
export function handleMultilibToggle(e) {
  const checked = e.target.checked;
  const passwordPrompt = document.getElementById("multilib-password-prompt");

  if (checked) {
    if (passwordPrompt) passwordPrompt.style.display = "block";
  } else {
    if (passwordPrompt) passwordPrompt.style.display = "none";
  }
}

// Save settings
export async function saveSettings() {
  const aurCheckbox = document.getElementById("enable-aur");
  const flatpakCheckbox = document.getElementById("enable-flatpak");
  const multilibCheckbox = document.getElementById("enable-multilib");
  const passwordInput = document.getElementById("sudo-password");
  const passwordError = document.getElementById("password-error");

  const newMultilibState = multilibCheckbox.checked;
  const oldMultilibState = settings.enableMultilib;

  if (newMultilibState && !oldMultilibState) {
    const password = passwordInput.value;

    if (!password) {
      if (passwordError) {
        passwordError.textContent = "Password required to enable multilib";
        passwordError.style.display = "block";
      }
      return;
    }

    try {
      const result = await invoke("enable_multilib", { password });
      if (passwordError) passwordError.style.display = "none";
      alert("Multilib enabled successfully! Repository synced.");
    } catch (err) {
      if (passwordError) {
        passwordError.textContent = "Failed: " + err;
        passwordError.style.display = "block";
      }
      multilibCheckbox.checked = false;
      setSettings({ enableMultilib: false });
      return;
    }
  }

  const newSettings = {
    enableAur: aurCheckbox.checked,
    enableFlatpak: flatpakCheckbox.checked,
    enableMultilib: multilibCheckbox.checked,
  };

  setSettings(newSettings);
  localStorage.setItem("archstore-settings", JSON.stringify(newSettings));

  closeSettings();

  const currentView = window.currentView || "home";
  if (currentView === "search") {
    const searchInput = document.getElementById("search-input");
    if (searchInput && searchInput.value.trim().length >= 2) {
      searchPackages(searchInput.value.trim());
    }
  } else if (currentView === "home") {
    showHomeScreen();
  }
}
