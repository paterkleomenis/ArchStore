import { listen } from "@tauri-apps/api/event";
import { currentView, currentApp } from "../main.js";
import { fetchAndShowAppDetail } from "./detail.js";

// Show password prompt
export function showPasswordPrompt() {
  return new Promise((resolve, reject) => {
    // Remove any existing password modals first
    const existingModal = document.getElementById("password-prompt-modal");
    if (existingModal) {
      console.log("[Password Prompt] Removing existing password modal");
      existingModal.remove();
    }

    const modal = document.createElement("div");
    modal.className = "modal active";
    modal.id = "password-prompt-modal";
    modal.style.zIndex = "10000"; // Ensure it's on top
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px;">
        <div class="modal-header">
          <h2 class="modal-title">Authentication Required</h2>
        </div>
        <div class="modal-body">
          <form id="password-form" style="margin: 0;">
            <p style="margin-bottom: 15px; color: #ccc;">Enter your sudo password to continue:</p>
            <input type="password" id="sudo-password-input"
                   placeholder="Password"
                   autocomplete="current-password"
                   style="width: 100%; padding: 10px; background: #2a2a2a; border: 1px solid #444; border-radius: 4px; color: white; font-size: 14px;" />
            <p style="margin-top: 10px; font-size: 12px; color: #888;">Your password will be used to execute privileged operations.</p>
          </form>
        </div>
        <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          <button type="button" class="cancel-password-btn" style="padding: 8px 20px; background: #444; border: none; border-radius: 4px; color: white; cursor: pointer;">Cancel</button>
          <button type="button" class="submit-password-btn" style="padding: 8px 20px; background: #1793d1; border: none; border-radius: 4px; color: white; cursor: pointer;">Submit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const passwordForm = modal.querySelector("#password-form");
    const passwordInput = modal.querySelector("#sudo-password-input");
    const submitBtn = modal.querySelector(".submit-password-btn");
    const cancelBtn = modal.querySelector(".cancel-password-btn");

    // Focus password input
    setTimeout(() => passwordInput.focus(), 100);

    // Handle form submission (Enter key)
    const handleSubmit = (e) => {
      if (e) e.preventDefault();
      const password = passwordInput.value.trim();
      if (!password) {
        passwordInput.style.borderColor = "#f00";
        passwordInput.placeholder = "Password is required!";
        return;
      }

      // Force remove modal immediately
      console.log("[Password Prompt] Password submitted, removing modal");
      modal.remove();

      // Also remove by ID as backup
      const modalById = document.getElementById("password-prompt-modal");
      if (modalById) {
        modalById.remove();
      }

      console.log("[Password Prompt] Modal removed, resolving promise");
      resolve(password);
    };

    // Form submit event (handles Enter key)
    passwordForm.addEventListener("submit", handleSubmit);

    // Submit button (calls the same handler)
    submitBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleSubmit();
    });

    // Cancel button
    cancelBtn.addEventListener("click", () => {
      modal.remove();
      const modalById = document.getElementById("password-prompt-modal");
      if (modalById) modalById.remove();
      reject(new Error("Password prompt cancelled"));
    });

    // Close on background click
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.remove();
        const modalById = document.getElementById("password-prompt-modal");
        if (modalById) modalById.remove();
        reject(new Error("Password prompt cancelled"));
      }
    });
  });
}

// Show modal
export function showModal(packageName) {
  const modal = document.getElementById("install-modal");
  const nameSpan = document.getElementById("modal-package-name");
  const terminal = document.getElementById("terminal-output");
  const progressFill = document.getElementById("progress-fill");

  nameSpan.textContent = packageName;
  terminal.innerHTML = "";

  // Add initial messages
  const initLine = document.createElement("div");
  initLine.className = "terminal-line";
  initLine.style.color = "#7aa2f7";
  initLine.textContent = `:: Initializing installation of ${packageName}...`;
  terminal.appendChild(initLine);

  // Add blinking cursor
  const cursor = document.createElement("span");
  cursor.className = "terminal-cursor";
  cursor.textContent = "█";
  cursor.style.color = "#7aa2f7";
  cursor.style.marginLeft = "4px";
  terminal.appendChild(cursor);

  progressFill.style.width = "0%";

  modal.classList.add("active");
}

// Close modal
export function closeModal() {
  const modal = document.getElementById("install-modal");
  if (modal) {
    modal.classList.remove("active");
  }
}

// Update progress
export function updateProgress(progress) {
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

// Add terminal line with enhanced styling and auto-scroll
export function addTerminalLine(text, type = "normal") {
  const terminal = document.getElementById("terminal-output");
  if (!terminal) return;

  const line = document.createElement("div");
  line.className = "terminal-line";
  line.style.marginBottom = "4px";
  line.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
  line.style.display = "flex";
  line.style.alignItems = "center";

  // Check for special formatting
  const isCheckmark = text.includes("✓");
  const isCross = text.includes("✗");

  // Enhanced color-coding based on content
  if (isCheckmark) {
    line.style.color = "#9ece6a";
    line.style.fontWeight = "500";
  } else if (
    isCross ||
    type === "error" ||
    text.toLowerCase().includes("error") ||
    text.toLowerCase().includes("failed")
  ) {
    line.style.color = "#f7768e";
    line.style.fontWeight = "bold";
  } else if (text.toLowerCase().includes("warning")) {
    line.style.color = "#e0af68";
  } else if (
    text.toLowerCase().includes("success") ||
    text.toLowerCase().includes("completed") ||
    text.toLowerCase().includes("installed") ||
    text.toLowerCase().includes("upgraded")
  ) {
    line.style.color = "#9ece6a";
    line.style.fontWeight = "500";
  } else if (
    text.toLowerCase().includes("downloading") ||
    text.toLowerCase().includes("fetching")
  ) {
    line.style.color = "#7dcfff";
  } else if (text.startsWith("::")) {
    line.style.color = "#bb9af7";
    line.style.fontWeight = "600";
  } else if (text.startsWith("=>")) {
    line.style.color = "#7aa2f7";
    line.style.fontWeight = "500";
  } else {
    line.style.color = "#a9b1d6";
  }

  // Add timestamp
  if (text.trim() !== "") {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    const timestampSpan = document.createElement("span");
    timestampSpan.style.color = "#565f89";
    timestampSpan.style.marginRight = "12px";
    timestampSpan.style.fontSize = "11px";
    timestampSpan.style.fontWeight = "normal";
    timestampSpan.style.flexShrink = "0";
    timestampSpan.textContent = `[${timestamp}]`;
    line.appendChild(timestampSpan);
  }

  // Add the text content
  const textSpan = document.createElement("span");
  textSpan.textContent = text;
  textSpan.style.flex = "1";
  line.appendChild(textSpan);

  terminal.appendChild(line);

  // Remove old cursor and add new one at the end
  const oldCursor = terminal.querySelector(".terminal-cursor");
  if (oldCursor) {
    oldCursor.remove();
  }

  // Add blinking cursor
  const cursor = document.createElement("span");
  cursor.className = "terminal-cursor";
  cursor.textContent = "█";
  cursor.style.color = "#7aa2f7";
  cursor.style.marginLeft = "4px";
  terminal.appendChild(cursor);

  // Smooth auto-scroll
  terminal.scrollTo({
    top: terminal.scrollHeight,
    behavior: "smooth",
  });
}

// Show remove modal
export function showRemoveModal(packageName) {
  let modal = document.getElementById("remove-modal");

  if (!modal) {
    // Create remove modal if it doesn't exist
    modal = document.createElement("div");
    modal.id = "remove-modal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 900px;">
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
export function updateRemoveProgress(progress) {
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
export function addRemoveTerminalLine(text, type = "normal") {
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

// Show update modal
export function showUpdateModal(title = "Updating System") {
  console.log("[Update Modal] Showing update modal with title:", title);

  // Force remove any lingering password modals
  const existingPasswordModals = document.querySelectorAll(
    "#password-prompt-modal, .modal.active",
  );
  existingPasswordModals.forEach((pm) => {
    if (pm.id !== "update-modal" && pm.id !== "settings-modal") {
      console.log(
        "[Update Modal] Force removing modal:",
        pm.id || pm.className,
      );
      pm.remove();
    }
  });

  const modal = document.getElementById("update-modal");
  const terminal = document.getElementById("update-terminal-output");
  const progressFill = document.getElementById("update-progress-fill");
  const modalTitle = document.querySelector("#update-modal .modal-title");

  if (!modal) {
    console.error("[Update Modal] Modal element not found!");
    return;
  }

  if (!terminal) {
    console.error("[Update Modal] Terminal element not found!");
    return;
  }

  // Ensure update modal has highest z-index and proper display
  modal.style.zIndex = "99999";
  modal.style.position = "fixed";
  modal.style.top = "0";
  modal.style.left = "0";
  modal.style.width = "100%";
  modal.style.height = "100%";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.background = "rgba(0, 0, 0, 0.85)";
  modal.style.backdropFilter = "blur(8px)";

  if (modalTitle) {
    modalTitle.textContent = title;
  }

  // Clear terminal and show initial message
  terminal.innerHTML = "";
  addUpdateTerminalLine("=".repeat(60), "normal");
  addUpdateTerminalLine(`  ${title.toUpperCase()}`, "normal");
  addUpdateTerminalLine("=".repeat(60), "normal");
  addUpdateTerminalLine("", "normal");
  addUpdateTerminalLine(":: Initializing update process...", "normal");

  // Add blinking cursor
  addTerminalCursor();

  progressFill.style.width = "0%";

  modal.classList.add("active");
  modal.style.visibility = "visible";
  modal.style.opacity = "1";

  // Bring modal content to front
  const modalContent = modal.querySelector(".modal-content");
  if (modalContent) {
    modalContent.style.position = "relative";
    modalContent.style.zIndex = "100000";
  }

  console.log(
    "[Update Modal] Modal displayed successfully with z-index:",
    modal.style.zIndex,
  );

  // Add close button handler
  const closeBtn = document.getElementById("close-update-modal");
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.classList.remove("active");
      modal.style.visibility = "hidden";
      modal.style.opacity = "0";
    };
  }
}

// Update update progress
export function updateUpdateProgress(progress) {
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

// Add update terminal line with enhanced styling
export function addUpdateTerminalLine(text, type = "normal") {
  const terminal = document.getElementById("update-terminal-output");
  if (!terminal) return;

  const line = document.createElement("div");
  line.className = "terminal-line";
  line.style.marginBottom = "4px";
  line.style.fontFamily = "'Consolas', 'Monaco', 'Courier New', monospace";
  line.style.display = "flex";
  line.style.alignItems = "center";

  // Check for special formatting
  const isCheckmark = text.includes("✓");
  const isCross = text.includes("✗");
  const isEquals = text.trim().startsWith("=".repeat(10));
  const isBracketProgress = text.match(/^\[(\d+)\/(\d+)\]/);

  // Enhanced color-coding based on content
  if (isCheckmark) {
    line.style.color = "#9ece6a";
    line.style.fontWeight = "500";
  } else if (
    isCross ||
    type === "error" ||
    text.toLowerCase().includes("error") ||
    text.toLowerCase().includes("failed")
  ) {
    line.style.color = "#f7768e";
    line.style.fontWeight = "bold";
  } else if (text.toLowerCase().includes("warning")) {
    line.style.color = "#e0af68";
  } else if (
    text.toLowerCase().includes("success") ||
    text.toLowerCase().includes("completed") ||
    text.toLowerCase().includes("installed") ||
    text.toLowerCase().includes("upgraded") ||
    text.toLowerCase().includes("updated successfully")
  ) {
    line.style.color = "#9ece6a";
    line.style.fontWeight = "500";
  } else if (
    text.toLowerCase().includes("downloading") ||
    text.toLowerCase().includes("fetching")
  ) {
    line.style.color = "#7dcfff";
  } else if (text.startsWith("::")) {
    line.style.color = "#bb9af7";
    line.style.fontWeight = "600";
  } else if (text.startsWith("=>")) {
    line.style.color = "#7aa2f7";
    line.style.fontWeight = "500";
  } else if (isBracketProgress) {
    line.style.color = "#7dcfff";
    line.style.fontWeight = "600";
  } else if (isEquals) {
    line.style.color = "#565f89";
    line.style.opacity = "0.5";
  } else if (
    text.includes("pacman") ||
    text.includes("yay") ||
    text.includes("paru") ||
    text.includes("flatpak")
  ) {
    line.style.color = "#9ece6a";
  } else if (
    text.includes("Sync") ||
    text.includes("updating") ||
    text.includes("Starting")
  ) {
    line.style.color = "#7aa2f7";
  } else if (text.match(/\d+\/\d+/)) {
    // Progress indicators like "1/5"
    line.style.color = "#73daca";
  } else {
    line.style.color = "#a9b1d6";
  }

  // Add timestamp (skip for separator lines and empty lines)
  if (!isEquals && text.trim() !== "") {
    const timestamp = new Date().toLocaleTimeString("en-US", { hour12: false });
    const timestampSpan = document.createElement("span");
    timestampSpan.style.color = "#565f89";
    timestampSpan.style.marginRight = "12px";
    timestampSpan.style.fontSize = "11px";
    timestampSpan.style.fontWeight = "normal";
    timestampSpan.style.flexShrink = "0";
    timestampSpan.textContent = `[${timestamp}]`;
    line.appendChild(timestampSpan);
  }

  // Add the text content
  const textSpan = document.createElement("span");
  textSpan.textContent = text;
  textSpan.style.flex = "1";
  line.appendChild(textSpan);

  terminal.appendChild(line);

  // Remove old cursor and add new one at the end
  const oldCursor = terminal.querySelector(".terminal-cursor");
  if (oldCursor) {
    oldCursor.remove();
  }
  addTerminalCursor();

  // Smooth auto-scroll
  terminal.scrollTo({
    top: terminal.scrollHeight,
    behavior: "smooth",
  });
}

// Add blinking cursor to terminal
function addTerminalCursor() {
  const terminal = document.getElementById("update-terminal-output");
  if (!terminal) return;

  const cursor = document.createElement("span");
  cursor.className = "terminal-cursor";
  cursor.textContent = "█";
  cursor.style.color = "#7aa2f7";
  cursor.style.animation = "cursorBlink 1s step-end infinite";
  cursor.style.marginLeft = "4px";
  cursor.style.fontSize = "13px";

  terminal.appendChild(cursor);
}
