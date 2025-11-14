import { invoke } from "@tauri-apps/api/core";
import { settings, setSettings, updateSettingsUI } from "../main.js";
import { showPasswordPrompt } from "./modal.js";
import { searchPackages } from "./search.js";
import { showHomeScreen } from "./home.js";
import { getSystemCapabilities } from "../api/system.js";

// Open settings modal
export async function openSettings() {
  updateSettingsUI();
  const passwordPrompt = document.getElementById("multilib-password-prompt");
  const passwordInput = document.getElementById("sudo-password");
  const passwordError = document.getElementById("password-error");

  if (passwordPrompt) passwordPrompt.style.display = "none";
  if (passwordInput) passwordInput.value = "";
  if (passwordError) passwordError.style.display = "none";

  // Check system capabilities
  await checkAndUpdateSourceAvailability();

  const modal = document.getElementById("settings-modal");
  modal.classList.add("active");
}

// Check which package sources are available on the system
async function checkAndUpdateSourceAvailability() {
  try {
    const capabilities = await getSystemCapabilities();

    const aurCheckbox = document.getElementById("enable-aur");
    const flatpakCheckbox = document.getElementById("enable-flatpak");
    const multilibCheckbox = document.getElementById("enable-multilib");

    // Get the label containers
    const aurLabel = aurCheckbox?.closest("label");
    const flatpakLabel = flatpakCheckbox?.closest("label");
    const multilibLabel = multilibCheckbox?.closest("label");

    // Update AUR availability
    if (aurCheckbox) {
      if (!capabilities.has_aur_helper) {
        aurCheckbox.disabled = true;
        aurCheckbox.checked = false;
        if (aurLabel) {
          aurLabel.style.opacity = "0.5";
          aurLabel.style.cursor = "not-allowed";
          // Add a note about missing AUR helper
          const descDiv = aurLabel.querySelector(
            "div:last-child > div:last-child",
          );
          if (descDiv && !descDiv.textContent.includes("yay or paru")) {
            descDiv.textContent = "Not available - install yay or paru first";
          }
        }
      } else {
        aurCheckbox.disabled = false;
        if (aurLabel) {
          aurLabel.style.opacity = "1";
          aurLabel.style.cursor = "pointer";
          const descDiv = aurLabel.querySelector(
            "div:last-child > div:last-child",
          );
          if (descDiv) {
            descDiv.textContent = "Community-maintained packages";
          }
        }
      }
    }

    // Update Flatpak availability
    if (flatpakCheckbox) {
      if (!capabilities.has_flatpak) {
        flatpakCheckbox.disabled = true;
        flatpakCheckbox.checked = false;
        if (flatpakLabel) {
          flatpakLabel.style.opacity = "0.5";
          flatpakLabel.style.cursor = "not-allowed";
          const descDiv = flatpakLabel.querySelector(
            "div:last-child > div:last-child",
          );
          if (descDiv && !descDiv.textContent.includes("install flatpak")) {
            descDiv.textContent = "Not available - install flatpak first";
          }
        }
      } else {
        flatpakCheckbox.disabled = false;
        if (flatpakLabel) {
          flatpakLabel.style.opacity = "1";
          flatpakLabel.style.cursor = "pointer";
          const descDiv = flatpakLabel.querySelector(
            "div:last-child > div:last-child",
          );
          if (descDiv) {
            descDiv.textContent = "Sandboxed applications";
          }
        }
      }
    }

    // Update Multilib status (show if already enabled)
    if (multilibCheckbox && capabilities.multilib_enabled) {
      multilibCheckbox.checked = true;
      if (multilibLabel) {
        const descDiv = multilibLabel.querySelector(
          "div:last-child > div:last-child",
        );
        if (descDiv) {
          descDiv.textContent = "32-bit packages on 64-bit system (enabled)";
        }
      }
      // Update settings to match
      setSettings({ enableMultilib: true });
    }
  } catch (error) {
    console.error("Failed to check system capabilities:", error);
  }
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
