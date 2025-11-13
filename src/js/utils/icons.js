/**
 * Icon mapping for applications
 * Returns icon URLs for known applications, with fallback placeholder
 */
export function getAppIcon(appName) {
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
