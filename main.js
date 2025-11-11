import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

let allPackages = [];
let currentFilter = "all";
let currentInstallFilter = "all"; // "all", "installed", "not-installed"
let currentSort = "relevance"; // "relevance", "name", "name-desc", "source"
let currentCategory = "all"; // Category filter
let searchTimeout = null;
let currentView = "home"; // "home", "search", "detail"
let currentApp = null;
let pendingRefreshData = null; // Store fetched data to update after modal closes
let lastUpdateCheck = null; // Timestamp of last update check
let updateCheckInterval = null; // Interval for periodic update checks

// Settings
let settings = {
  enableAur: true,
  enableFlatpak: true,
  enableMultilib: false,
};

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

// Event listeners
function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", handleSearch);

  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", handleFilterChange);
  });

  const closeBtn = document.getElementById("close-modal");
  closeBtn.addEventListener("click", closeModal);

  const settingsBtn = document.getElementById("settings-btn");
  settingsBtn.addEventListener("click", openSettings);

  const closeSettingsBtn = document.getElementById("close-settings-modal");
  closeSettingsBtn.addEventListener("click", closeSettings);

  const saveSettingsBtn = document.getElementById("save-settings");
  saveSettingsBtn.addEventListener("click", saveSettings);

  const multilibCheckbox = document.getElementById("enable-multilib");
  multilibCheckbox.addEventListener("change", handleMultilibToggle);

  const logo = document.querySelector(".logo");
  logo.addEventListener("click", returnToHome);
  logo.style.cursor = "pointer";

  // Filter and Sort dropdowns
  const filterBtn = document.getElementById("filter-btn");
  const sortBtn = document.getElementById("sort-btn");
  const filterDropdown = document.getElementById("filter-dropdown");
  const sortDropdown = document.getElementById("sort-dropdown");

  filterBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    filterDropdown.classList.toggle("active");
    sortDropdown.classList.remove("active");
  });

  sortBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    sortDropdown.classList.toggle("active");
    filterDropdown.classList.remove("active");
  });

  // Close dropdowns when clicking outside
  document.addEventListener("click", () => {
    filterDropdown.classList.remove("active");
    sortDropdown.classList.remove("active");
  });

  // Filter options
  document
    .querySelectorAll("#filter-dropdown .dropdown-option")
    .forEach((option) => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const filter = option.dataset.filter;
        currentInstallFilter = filter;

        // Update selected state
        document
          .querySelectorAll("#filter-dropdown .dropdown-option")
          .forEach((opt) => {
            opt.classList.remove("selected");
          });
        option.classList.add("selected");

        filterDropdown.classList.remove("active");
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

        // Update selected state
        document
          .querySelectorAll("#sort-dropdown .dropdown-option")
          .forEach((opt) => {
            opt.classList.remove("selected");
          });
        option.classList.add("selected");

        sortDropdown.classList.remove("active");
        if (currentView === "search") {
          const filtered = filterAndSortPackages(allPackages);
          renderPackages(filtered);
        }
      });
    });

  // Update check button
  const checkUpdatesBtn = document.getElementById("check-updates-btn");
  checkUpdatesBtn.addEventListener("click", handleCheckUpdates);

  const updateAllBtn = document.getElementById("update-all-btn");
  updateAllBtn.addEventListener("click", handleUpdateAll);
}

// Handle check updates button
async function handleCheckUpdates() {
  const btn = document.getElementById("check-updates-btn");
  const updatesList = document.getElementById("updates-list");
  const updatesContainer = document.getElementById("updates-container");
  const updatesCount = document.getElementById("updates-count");

  // Show loading state
  btn.textContent = "Checking...";
  btn.disabled = true;

  try {
    const updates = await checkForUpdates();

    if (updates && updates.length > 0) {
      // Show updates
      updatesCount.textContent = updates.length;
      updatesList.style.display = "block";

      // Build updates list HTML
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
      // No updates
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

  btn.textContent = "Updating...";
  btn.disabled = true;

  try {
    // Prompt for password first
    const password = await showPasswordPrompt();

    // Show update modal
    showUpdateModal();

    await invoke("update_system", { password });

    // Close settings modal after update
    setTimeout(() => {
      closeSettings();
      // Refresh update check
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

// Return to home screen
function returnToHome() {
  const searchInput = document.getElementById("search-input");
  searchInput.value = "";
  currentView = "home";
  allPackages = [];
  currentFilter = "all";

  // Reset tab selection
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
    if (btn.dataset.source === "all") {
      btn.classList.add("active");
    }
  });

  showHomeScreen();
}

// Search packages with incremental results
async function searchPackages(query) {
  showLoading("Searching official repositories...");

  // Reset packages
  allPackages = [];
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
      allPackages = [];
      for (const [normalizedName, packages] of Object.entries(grouped)) {
        if (packages.length === 1) {
          // Single package, keep as is
          allPackages.push(packages[0]);
        } else {
          // Multiple packages, merge them
          const baseName = packages[0].name.toLowerCase().replace(/[._-]/g, "");
          const merged = mergeAppSources(baseName, packages);
          if (merged) {
            // Convert merged app to package format for search results
            allPackages.push({
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
      allPackages.sort((a, b) => {
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

      // Display results immediately with status
      const filtered = filterAndSortPackages(allPackages);
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

// Calculate relevance score
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
function filterAndSortPackages(packages) {
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

// Category definitions
const CATEGORIES = {
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
async function showHomeScreen() {
  const container = document.getElementById("packages-container");

  // Instant load - no spinner needed

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

// Normalize app name for comparison
function normalizeAppName(name) {
  let normalized = name.toLowerCase();

  // Handle Flatpak reverse domain notation (com.valvesoftware.Steam -> steam)
  if (normalized.match(/^(com|org|io|net|app)\.[a-z0-9]+\./)) {
    // Extract the last component as the app name
    const parts = normalized.split(".");
    normalized = parts[parts.length - 1];
  }

  // Only remove common suffixes, NOT prefixes
  // This prevents python-mpv from being treated as mpv
  normalized = normalized.replace(
    /-bin$|-git$|-stable$|-beta$|-dev$|-desktop$/,
    "",
  );

  // Remove separators
  normalized = normalized.replace(/[._-]/g, "");

  return normalized.trim();
}

// Merge app from different sources into one unified entry
function mergeAppSources(baseName, packages) {
  if (packages.length === 0) return null;

  const sources = {};
  let primaryPackage = null;

  // Add all packages from different sources
  packages.forEach((pkg) => {
    // Prefer official > flatpak > aur for the same source
    if (!sources[pkg.source] || pkg.source === "official") {
      sources[pkg.source] = pkg;
    }

    // Set primary package (prefer official)
    if (!primaryPackage || pkg.source === "official") {
      primaryPackage = pkg;
    }
  });

  if (!primaryPackage) return null;

  // Use the cleanest name for display
  let displayName = baseName;

  // Special case nice names
  const niceNames = {
    firefox: "Firefox",
    chromium: "Chromium",
    brave: "Brave Browser",
    code: "Visual Studio Code",
    git: "Git",
    docker: "Docker",
    python: "Python",
    nodejs: "Node.js",
    vlc: "VLC Media Player",
    mpv: "MPV",
    gimp: "GIMP",
    "obs-studio": "OBS Studio",
    kdenlive: "Kdenlive",
    blender: "Blender",
    "libreoffice-fresh": "LibreOffice",
    thunderbird: "Thunderbird",
    discord: "Discord",
    "telegram-desktop": "Telegram",
    spotify: "Spotify",
    htop: "htop",
    steam: "Steam",
  };

  if (niceNames[baseName]) {
    displayName = niceNames[baseName];
  } else if (sources.flatpak) {
    // Extract app name from Flatpak description
    const flatpakDesc = sources.flatpak.description || "";
    const parts = flatpakDesc.split(" - ");
    if (parts.length > 0 && parts[0].trim()) {
      displayName = parts[0].trim();
    }
  } else if (sources.official) {
    displayName = sources.official.name;
  } else if (sources.aur) {
    displayName = sources.aur.name;
  }

  // Get description from the best source
  let description = primaryPackage.description;
  if (sources.flatpak && sources.flatpak.description.includes(" - ")) {
    description = sources.flatpak.description.split(" - ")[1] || description;
  }

  return {
    name: baseName,
    displayName: displayName,
    description: description,
    version: primaryPackage.version,
    sources: sources,
    icon: getAppIcon(baseName),
  };
}

// Get app icon URL
function getAppIcon(appName) {
  const iconMap = {
    firefox:
      "https://upload.wikimedia.org/wikipedia/commons/a/a0/Firefox_logo%2C_2019.svg",
    chromium:
      "https://upload.wikimedia.org/wikipedia/commons/f/fe/Chromium_Material_Icon.svg",
    brave: "https://brave.com/static-assets/images/brave-logo-sans-text.svg",
    "zen-browser":
      "https://raw.githubusercontent.com/zen-browser/desktop/main/assets/icon.svg",
    floorp:
      "https://raw.githubusercontent.com/Floorp-Projects/Floorp/main/floorp/branding/official/default256.png",
    code: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Visual_Studio_Code_1.35_icon.svg",
    git: "https://git-scm.com/images/logos/downloads/Git-Icon-1788C.png",
    docker: "https://www.docker.com/wp-content/uploads/2022/03/Moby-logo.png",
    zed: "https://zed.dev/img/logo.svg",
    lmstudio: "https://lmstudio.ai/favicon.svg",
    ollama: "https://ollama.com/public/ollama.png",
    vlc: "https://upload.wikimedia.org/wikipedia/commons/e/e6/VLC_Icon.svg",
    mpv: "https://upload.wikimedia.org/wikipedia/commons/c/c9/Mpv-icon.svg",
    gimp: "https://upload.wikimedia.org/wikipedia/commons/4/45/The_GIMP_icon_-_gnome.svg",
    "obs-studio": "https://obsproject.com/assets/images/new_icon_small-r.png",
    blender:
      "https://upload.wikimedia.org/wikipedia/commons/0/0c/Blender_logo_no_text.svg",
    spotify:
      "https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_Green.png",
    audacity:
      "https://upload.wikimedia.org/wikipedia/commons/f/f6/Audacity_Logo.svg",
    stremio: "https://www.stremio.com/website/stremio-logo-small.png",
    inkscape:
      "https://upload.wikimedia.org/wikipedia/commons/0/0d/Inkscape_Logo.svg",
    krita:
      "https://upload.wikimedia.org/wikipedia/commons/7/73/Calligrakrita-base.svg",
    libreoffice:
      "https://upload.wikimedia.org/wikipedia/commons/e/e8/LibreOffice_Logo.svg",
    openoffice: "https://www.openoffice.org/favicon.ico",
    onlyoffice:
      "https://www.onlyoffice.com/blog/wp-content/uploads/2023/11/logo_onlyoffice.svg",
    thunderbird:
      "https://upload.wikimedia.org/wikipedia/commons/d/df/Mozilla_Thunderbird_logo.svg",
    discord:
      "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png",
    telegram:
      "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
    qbittorrent:
      "https://upload.wikimedia.org/wikipedia/commons/6/66/New_qBittorrent_Logo.svg",
    steam:
      "https://upload.wikimedia.org/wikipedia/commons/8/83/Steam_icon_logo.svg",
    heroic: "https://heroicgameslauncher.com/img/logo.svg",
    htop: "https://raw.githubusercontent.com/htop-dev/htop/main/htop.png",
    "mission-center":
      "https://gitlab.com/mission-center-devs/mission-center/-/raw/main/data/icons/hicolor/scalable/apps/io.missioncenter.MissionCenter.svg",
    ghostty: "https://ghostty.org/favicon.svg",
  };

  return (
    iconMap[appName.toLowerCase()] ||
    "https://via.placeholder.com/64?text=" + appName[0].toUpperCase()
  );
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

// Fetch real package data and show detail view
// Fetch app detail data without showing loading UI
async function fetchAppDetailData(app) {
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

async function fetchAndShowAppDetail(app) {
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
function showAppDetail(app) {
  currentView = "detail";
  currentApp = app;
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

// Filter change handler
function handleFilterChange(e) {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  e.target.classList.add("active");

  currentFilter = e.target.dataset.source;
  renderPackages(filterPackages(allPackages));
}

// Filter packages by source
function filterPackages(packages) {
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
function renderPackages(packages, searching = false, sourceName = "") {
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
      installBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pkg = JSON.parse(card.dataset.package);
        installPackage(pkg.name, pkg.source);
      });
    }
  });
}

// Show password prompt
function showPasswordPrompt() {
  return new Promise((resolve, reject) => {
    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.id = "password-prompt-modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2 class="modal-title">Authentication Required</h2>
        </div>
        <div class="modal-body">
          <p style="margin-bottom: 15px; color: #ccc;">Enter your sudo password to continue:</p>
          <input type="password" id="sudo-password-input"
                 placeholder="Password"
                 style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: white; font-size: 14px;" />
          <p style="margin-top: 10px; font-size: 12px; color: #888;">Your password will be used to execute privileged operations.</p>
        </div>
        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          <button class="cancel-password-btn" style="padding: 8px 20px; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer;">Cancel</button>
          <button class="submit-password-btn" style="padding: 8px 20px; background: #1793d1; border: none; border-radius: 4px; color: white; cursor: pointer;">Submit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const passwordInput = modal.querySelector("#sudo-password-input");
    const submitBtn = modal.querySelector(".submit-password-btn");
    const cancelBtn = modal.querySelector(".cancel-password-btn");

    // Focus password input
    setTimeout(() => passwordInput.focus(), 100);

    // Submit on Enter key
    passwordInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        submitBtn.click();
      }
    });

    // Submit button
    submitBtn.addEventListener("click", () => {
      const password = passwordInput.value;
      if (!password) {
        passwordInput.style.borderColor = "#f00";
        return;
      }
      document.body.removeChild(modal);
      resolve(password);
    });

    // Cancel button
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(modal);
      reject(new Error("Password prompt cancelled"));
    });

    // Close on background click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        reject(new Error("Password prompt cancelled"));
      }
    });
  });
}

// Install package
async function installPackage(name, source) {
  try {
    // Prompt for password first (only for official and AUR, not flatpak)
    let password = "";
    if (source !== "flatpak") {
      password = await showPasswordPrompt();
    }

    showModal(name);

    await invoke("install_package", {
      packageName: name,
      source,
      password,
    });
  } catch (error) {
    if (error.message === "Password prompt cancelled") {
      addTerminalLine("Installation cancelled by user", "error");
    } else {
      addTerminalLine("ERROR: " + error, "error");
    }
  }
}

// Setup install progress listener
async function setupInstallListener() {
  await listen("install-progress", (event) => {
    const progress = event.payload;
    updateProgress(progress);
  });
}

// Show modal
function showModal(packageName) {
  const modal = document.getElementById("install-modal");
  const nameSpan = document.getElementById("modal-package-name");
  const terminal = document.getElementById("terminal-output");
  const progressFill = document.getElementById("progress-fill");

  nameSpan.textContent = packageName;
  terminal.innerHTML =
    '<div class="terminal-line">Initializing installation...</div>';
  progressFill.style.width = "0%";

  modal.classList.add("active");
}

// Close modal
function closeModal() {
  const modal = document.getElementById("install-modal");
  modal.classList.remove("active");
}

// Update progress
function updateProgress(progress) {
  const progressFill = document.getElementById("progress-fill");
  progressFill.style.width = progress.percentage + "%";

  addTerminalLine(progress.message);

  if (progress.completed) {
    // Close modal after showing success message
    setTimeout(() => {
      closeModal();
      // Refresh the app detail view after successful installation
      if (currentView === "detail" && currentApp) {
        setTimeout(() => {
          fetchAndShowAppDetail(currentApp);
        }, 500);
      }
    }, 2000);
  }
}

// Add terminal line
function addTerminalLine(text, type = "normal") {
  const terminal = document.getElementById("terminal-output");
  const line = document.createElement("div");
  line.className = "terminal-line";
  line.textContent = text;
  if (type === "error") {
    line.style.color = "#f00";
  }
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
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
      addRemoveTerminalLine("Removal cancelled by user", "error");
    } else {
      addRemoveTerminalLine("ERROR: " + error, "error");
    }
  }
}

// Show remove modal
function showRemoveModal(packageName) {
  let modal = document.getElementById("remove-modal");

  if (!modal) {
    // Create remove modal if it doesn't exist
    modal = document.createElement("div");
    modal.id = "remove-modal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2 class="modal-title">
            Removing <span id="remove-modal-package-name"></span>
          </h2>
          <button class="close-btn" id="close-remove-modal-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="progress-bar">
            <div class="progress-fill" id="remove-progress-fill"></div>
          </div>
          <div class="terminal" id="remove-terminal-output">
            <div class="terminal-line">Initializing removal...</div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document
      .getElementById("close-remove-modal-btn")
      .addEventListener("click", () => {
        modal.classList.remove("active");
      });
  }

  const nameSpan = document.getElementById("remove-modal-package-name");
  const terminal = document.getElementById("remove-terminal-output");
  const progressFill = document.getElementById("remove-progress-fill");

  nameSpan.textContent = packageName;
  terminal.innerHTML =
    '<div class="terminal-line">Initializing removal...</div>';
  progressFill.style.width = "0%";

  modal.classList.add("active");
}

// Update remove progress
function updateRemoveProgress(progress) {
  const progressFill = document.getElementById("remove-progress-fill");
  progressFill.style.width = progress.percentage + "%";

  addRemoveTerminalLine(progress.message);

  if (progress.completed) {
    // Close modal after showing success message
    setTimeout(() => {
      const modal = document.getElementById("remove-modal");
      if (modal) {
        modal.classList.remove("active");
      }
    }, 2000);
  }
}

// Add remove terminal line
function addRemoveTerminalLine(text, type = "normal") {
  const terminal = document.getElementById("remove-terminal-output");
  if (!terminal) return;

  const line = document.createElement("div");
  line.className = "terminal-line";
  line.textContent = text;
  if (type === "error") {
    line.style.color = "#f00";
  }
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// Setup remove progress listener
async function setupRemoveListener() {
  await listen("remove-progress", (event) => {
    const progress = event.payload;
    updateRemoveProgress(progress);
  });
}

// Show update modal
function showUpdateModal() {
  const modal = document.getElementById("update-modal");
  const terminal = document.getElementById("update-terminal-output");
  const progressFill = document.getElementById("update-progress-fill");

  terminal.innerHTML =
    '<div class="terminal-line">Initializing system update...</div>';
  progressFill.style.width = "0%";

  modal.classList.add("active");

  // Add close button handler
  const closeBtn = document.getElementById("close-update-modal");
  closeBtn.onclick = () => {
    modal.classList.remove("active");
  };
}

// Update update progress
function updateUpdateProgress(progress) {
  const progressFill = document.getElementById("update-progress-fill");
  progressFill.style.width = progress.percentage + "%";

  addUpdateTerminalLine(progress.message);

  if (progress.completed) {
    // Close modal after showing success message
    setTimeout(() => {
      const modal = document.getElementById("update-modal");
      if (modal) {
        modal.classList.remove("active");
      }
    }, 2000);
  }
}

// Add update terminal line
function addUpdateTerminalLine(text, type = "normal") {
  const terminal = document.getElementById("update-terminal-output");
  if (!terminal) return;

  const line = document.createElement("div");
  line.className = "terminal-line";
  line.textContent = text;
  if (type === "error") {
    line.style.color = "#f00";
  }
  terminal.appendChild(line);
  terminal.scrollTop = terminal.scrollHeight;
}

// Setup update progress listener
async function setupUpdateListener() {
  await listen("update-progress", (event) => {
    const progress = event.payload;
    updateUpdateProgress(progress);
  });
}

// Setup update checker (every 12 hours)
async function setupUpdateChecker() {
  // Check immediately on startup
  await checkForUpdates();

  // Check every 12 hours
  updateCheckInterval = setInterval(
    async () => {
      await checkForUpdates();
    },
    12 * 60 * 60 * 1000,
  ); // 12 hours in milliseconds
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

  // Remove existing badge if any
  const existingBadge = settingsBtn.querySelector(".update-badge");
  if (existingBadge) {
    existingBadge.remove();
  }

  // Add new badge
  const badge = document.createElement("span");
  badge.className = "update-badge";
  badge.textContent = count;
  settingsBtn.style.position = "relative";
  settingsBtn.appendChild(badge);
}

// Manual update check (from settings/button)
async function manualUpdateCheck() {
  const updates = await checkForUpdates();
  return updates;
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

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

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

// Open settings modal
function openSettings() {
  updateSettingsUI();
  const passwordPrompt = document.getElementById("multilib-password-prompt");
  const passwordInput = document.getElementById("sudo-password");
  const passwordError = document.getElementById("password-error");

  passwordPrompt.style.display = "none";
  passwordInput.value = "";
  passwordError.style.display = "none";

  const modal = document.getElementById("settings-modal");
  modal.classList.add("active");
}

// Close settings modal
function closeSettings() {
  const modal = document.getElementById("settings-modal");
  modal.classList.remove("active");
}

// Handle multilib toggle
function handleMultilibToggle(e) {
  const checked = e.target.checked;
  const passwordPrompt = document.getElementById("multilib-password-prompt");

  if (checked) {
    passwordPrompt.style.display = "block";
  } else {
    passwordPrompt.style.display = "none";
  }
}

// Save settings
async function saveSettings() {
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
      passwordError.textContent = "Password required to enable multilib";
      passwordError.style.display = "block";
      return;
    }

    try {
      const result = await invoke("enable_multilib", { password });
      passwordError.style.display = "none";
      alert("Multilib enabled successfully! Repository synced.");
    } catch (err) {
      passwordError.textContent = "Failed: " + err;
      passwordError.style.display = "block";
      multilibCheckbox.checked = false;
      settings.enableMultilib = false;
      return;
    }
  }

  settings.enableAur = aurCheckbox.checked;
  settings.enableFlatpak = flatpakCheckbox.checked;
  settings.enableMultilib = multilibCheckbox.checked;

  localStorage.setItem("archstore-settings", JSON.stringify(settings));

  closeSettings();

  if (currentView === "search") {
    const searchInput = document.getElementById("search-input");
    if (searchInput.value.trim().length >= 2) {
      searchPackages(searchInput.value.trim());
    }
  } else if (currentView === "home") {
    showHomeScreen();
  }
}
