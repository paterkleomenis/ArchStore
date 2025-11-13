import { invoke } from "@tauri-apps/api/core";
import { getAppIcon } from "../utils/icons.js";
import {
  escapeHtml,
  setCurrentView,
  setCurrentFilter,
  setAllPackages,
} from "../main.js";
import { fetchAndShowAppDetail } from "./detail.js";

// Category definitions
export const CATEGORIES = {
  all: { name: "All Apps", icon: "Apps" },
  browsers: { name: "Web Browsers", icon: "Globe" },
  development: { name: "Development", icon: "Code" },
  graphics: { name: "Graphics & Design", icon: "Palette" },
  gaming: { name: "Gaming", icon: "Gamepad" },
  multimedia: { name: "Multimedia", icon: "Music" },
  office: { name: "Office", icon: "FileText" },
  utilities: { name: "Utilities", icon: "Tool" },
  internet: { name: "Internet", icon: "Wifi" },
  system: { name: "System Tools", icon: "Settings" },
};

// Show home screen with popular apps
export async function showHomeScreen() {
  const container = document.getElementById("packages-container");

  try {
    // Get popular apps (instant - no searching)
    const popularApps = await fetchPopularApps();
    renderHomeApps(popularApps);
  } catch (error) {
    container.innerHTML = `
      <div class="home-screen">
        <div class="home-header">
          <h1>Discover Apps</h1>
          <p>Search for any package to get started</p>
        </div>
      </div>
    `;
  }
}

// Return to home screen
export function returnToHome() {
  const searchInput = document.getElementById("search-input");
  searchInput.value = "";
  setCurrentView("home");
  setAllPackages([]);
  setCurrentFilter("all");

  // Reset tab selection
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.source === "all") {
      btn.classList.add("active");
    }
  });

  showHomeScreen();
}

// Get popular apps - hardcoded for instant loading with categories
async function fetchPopularApps() {
  const popularApps = [
    {
      name: "firefox",
      displayName: "Firefox",
      description: "Fast, Private & Safe Web Browser",
      sources: { official: "firefox", flatpak: "org.mozilla.firefox" },
      icon: getAppIcon("firefox"),
      category: "browsers",
    },
    {
      name: "chromium",
      displayName: "Chromium",
      description: "Open-source web browser from Google",
      sources: { official: "chromium", flatpak: "org.chromium.Chromium" },
      icon: getAppIcon("chromium"),
      category: "browsers",
    },
    {
      name: "brave",
      displayName: "Brave Browser",
      description: "Privacy-focused browser with ad blocking",
      sources: { aur: "brave-bin" },
      icon: getAppIcon("brave"),
      category: "browsers",
    },
    {
      name: "zen-browser",
      displayName: "Zen Browser",
      description: "Privacy-focused Firefox-based browser",
      sources: { aur: "zen-browser-bin" },
      icon: getAppIcon("zen-browser"),
      category: "browsers",
    },
    {
      name: "floorp",
      displayName: "Floorp",
      description: "Customizable Firefox-based browser",
      sources: { aur: "floorp-bin" },
      icon: getAppIcon("floorp"),
      category: "browsers",
    },
    {
      name: "code",
      displayName: "Visual Studio Code",
      description: "Code editor from Microsoft",
      sources: {
        aur: "visual-studio-code-bin",
        flatpak: "com.visualstudio.code",
      },
      icon: getAppIcon("code"),
      category: "development",
    },
    {
      name: "git",
      displayName: "Git",
      description: "Fast distributed version control system",
      sources: { official: "git" },
      icon: getAppIcon("git"),
      category: "development",
    },
    {
      name: "docker",
      displayName: "Docker",
      description: "Container platform",
      sources: { official: "docker" },
      icon: getAppIcon("docker"),
      category: "development",
    },
    {
      name: "zed",
      displayName: "Zed",
      description: "High-performance code editor",
      sources: { aur: "zed" },
      icon: getAppIcon("zed"),
      category: "development",
    },
    {
      name: "lmstudio",
      displayName: "LM Studio",
      description: "Run LLMs locally",
      sources: { aur: "lmstudio" },
      icon: getAppIcon("lmstudio"),
      category: "development",
    },
    {
      name: "ollama",
      displayName: "Ollama",
      description: "Run large language models locally",
      sources: { official: "ollama" },
      icon: getAppIcon("ollama"),
      category: "development",
    },
    {
      name: "vlc",
      displayName: "VLC Media Player",
      description: "Multi-platform media player",
      sources: { official: "vlc", flatpak: "org.videolan.VLC" },
      icon: getAppIcon("vlc"),
      category: "multimedia",
    },
    {
      name: "gimp",
      displayName: "GIMP",
      description: "GNU Image Manipulation Program",
      sources: { official: "gimp", flatpak: "org.gimp.GIMP" },
      icon: getAppIcon("gimp"),
      category: "graphics",
    },
    {
      name: "obs-studio",
      displayName: "OBS Studio",
      description: "Video recording and streaming",
      sources: { official: "obs-studio", flatpak: "com.obsproject.Studio" },
      icon: getAppIcon("obs-studio"),
      category: "multimedia",
    },
    {
      name: "spotify",
      displayName: "Spotify",
      description: "Music streaming service",
      sources: { flatpak: "com.spotify.Client" },
      icon: getAppIcon("spotify"),
      category: "multimedia",
    },
    {
      name: "audacity",
      displayName: "Audacity",
      description: "Audio editing software",
      sources: { official: "audacity", flatpak: "org.audacityteam.Audacity" },
      icon: getAppIcon("audacity"),
      category: "multimedia",
    },
    {
      name: "stremio",
      displayName: "Stremio",
      description: "Media streaming application",
      sources: { flatpak: "com.stremio.Stremio" },
      icon: getAppIcon("stremio"),
      category: "multimedia",
    },
    {
      name: "blender",
      displayName: "Blender",
      description: "3D creation suite",
      sources: { official: "blender" },
      icon: getAppIcon("blender"),
      category: "graphics",
    },
    {
      name: "inkscape",
      displayName: "Inkscape",
      description: "Vector graphics editor",
      sources: { official: "inkscape", flatpak: "org.inkscape.Inkscape" },
      icon: getAppIcon("inkscape"),
      category: "graphics",
    },
    {
      name: "krita",
      displayName: "Krita",
      description: "Digital painting application",
      sources: { official: "krita", flatpak: "org.kde.krita" },
      icon: getAppIcon("krita"),
      category: "graphics",
    },
    {
      name: "libreoffice-fresh",
      displayName: "LibreOffice",
      description: "Office suite",
      sources: { official: "libreoffice-fresh" },
      icon: getAppIcon("libreoffice"),
      category: "office",
    },
    {
      name: "openoffice",
      displayName: "Apache OpenOffice",
      description: "Open source office suite",
      sources: { aur: "openoffice-bin" },
      icon: getAppIcon("openoffice"),
      category: "office",
    },
    {
      name: "onlyoffice",
      displayName: "ONLYOFFICE",
      description: "Office suite with MS Office compatibility",
      sources: { aur: "onlyoffice-bin" },
      icon: getAppIcon("onlyoffice"),
      category: "office",
    },
    {
      name: "thunderbird",
      displayName: "Thunderbird",
      description: "Email client",
      sources: { official: "thunderbird" },
      icon: getAppIcon("thunderbird"),
      category: "internet",
    },
    {
      name: "discord",
      displayName: "Discord",
      description: "Voice and chat for gamers",
      sources: { flatpak: "com.discordapp.Discord" },
      icon: getAppIcon("discord"),
      category: "internet",
    },
    {
      name: "telegram-desktop",
      displayName: "Telegram",
      description: "Messaging app",
      sources: { official: "telegram-desktop" },
      icon: getAppIcon("telegram"),
      category: "internet",
    },
    {
      name: "qbittorrent",
      displayName: "qBittorrent",
      description: "BitTorrent client",
      sources: {
        official: "qbittorrent",
        flatpak: "org.qbittorrent.qBittorrent",
      },
      icon: getAppIcon("qbittorrent"),
      category: "internet",
    },
    {
      name: "steam",
      displayName: "Steam",
      description: "Gaming platform",
      sources: {
        official: "steam",
        aur: "steam",
        flatpak: "com.valvesoftware.Steam",
      },
      icon: getAppIcon("steam"),
      category: "gaming",
    },
    {
      name: "heroic",
      displayName: "Heroic Games Launcher",
      description: "Epic Games and GOG launcher",
      sources: { flatpak: "com.heroicgameslauncher.hgl" },
      icon: getAppIcon("heroic"),
      category: "gaming",
    },
    {
      name: "htop",
      displayName: "htop",
      description: "Interactive process viewer",
      sources: { official: "htop" },
      icon: getAppIcon("htop"),
      category: "system",
    },
    {
      name: "mission-center",
      displayName: "Mission Center",
      description: "System monitor for Linux",
      sources: { flatpak: "io.missioncenter.MissionCenter" },
      icon: getAppIcon("mission-center"),
      category: "system",
    },
    {
      name: "ghostty",
      displayName: "Ghostty",
      description: "Modern terminal emulator",
      sources: { aur: "ghostty" },
      icon: getAppIcon("ghostty"),
      category: "system",
    },
    {
      name: "mpv",
      displayName: "MPV",
      description: "Minimalist video player",
      sources: { official: "mpv", flatpak: "io.mpv.Mpv" },
      icon: getAppIcon("mpv"),
      category: "multimedia",
    },
  ];

  return popularApps;
}

// Render home screen apps with categories
function renderHomeApps(apps) {
  const container = document.getElementById("packages-container");

  // Group apps by category
  const categorizedApps = {};
  apps.forEach((app) => {
    const category = app.category || "utilities";
    if (!categorizedApps[category]) {
      categorizedApps[category] = [];
    }
    categorizedApps[category].push(app);
  });

  let html = `
    <div class="home-screen">
      <div class="home-header">
        <h1>Discover Apps</h1>
        <p>Browse applications by category</p>
      </div>

      <div class="category-tabs">
        <button class="category-tab active" data-category="all">All Apps</button>
  `;

  // Add category tabs
  Object.keys(CATEGORIES).forEach((categoryId) => {
    if (categoryId !== "all" && categorizedApps[categoryId]) {
      const category = CATEGORIES[categoryId];
      html += `<button class="category-tab" data-category="${categoryId}">${category.name}</button>`;
    }
  });

  html += `</div>`;

  // Render each category section
  Object.keys(CATEGORIES).forEach((categoryId) => {
    if (categoryId === "all") return;

    const categoryApps = categorizedApps[categoryId] || [];
    if (categoryApps.length === 0) return;

    const category = CATEGORIES[categoryId];

    html += `
      <div class="category-section" data-category="${categoryId}">
        <div class="category-header">
          <h2 class="category-title">${category.name}</h2>
          <span class="category-count">${categoryApps.length} apps</span>
        </div>
        <div class="popular-apps-grid">
    `;

    categoryApps.forEach((app) => {
      const sourceBadges = Object.keys(app.sources)
        .map((s) => `<span class="source-badge source-${s}">${s}</span>`)
        .join("");

      html += `
        <div class="popular-app-card" data-app='${JSON.stringify(app).replace(/'/g, "&#39;")}'>
          <div class="app-icon">
            <img src="${escapeHtml(app.icon)}" alt="${escapeHtml(app.name)}" onerror="this.src='https://via.placeholder.com/64?text=${app.name[0].toUpperCase()}'">
          </div>
          <div class="app-info">
            <div class="app-name">${escapeHtml(app.displayName)}</div>
            <div class="app-description">${escapeHtml(app.description)}</div>
            <div class="app-sources">${sourceBadges}</div>
          </div>
          <button class="app-view-btn">View</button>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `</div>`;

  container.innerHTML = html;

  // Add category tab handlers
  document.querySelectorAll(".category-tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const category = e.target.dataset.category;

      // Update active tab
      document.querySelectorAll(".category-tab").forEach((t) => {
        t.classList.remove("active");
      });
      e.target.classList.add("active");

      // Show/hide categories
      document.querySelectorAll(".category-section").forEach((section) => {
        if (category === "all") {
          section.style.display = "block";
        } else {
          section.style.display =
            section.dataset.category === category ? "block" : "none";
        }
      });
    });
  });

  // Add click handlers
  document.querySelectorAll(".popular-app-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      if (
        !e.target.classList.contains("app-view-btn") &&
        !e.target.closest(".app-view-btn")
      ) {
        return;
      }
      const appData = JSON.parse(card.dataset.app);
      fetchAndShowAppDetail(appData);
    });
  });

  document.querySelectorAll(".app-view-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = e.target.closest(".popular-app-card");
      const appData = JSON.parse(card.dataset.app);
      fetchAndShowAppDetail(appData);
    });
  });
}
