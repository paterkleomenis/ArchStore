import { listen } from "@tauri-apps/api/event";
import { currentView, currentApp } from "../main.js";
import { fetchAndShowAppDetail } from "./detail.js";

// Show password prompt
export function showPasswordPrompt() {
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

// Show modal
export function showModal(packageName) {
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

// Add terminal line
export function addTerminalLine(text, type = "normal") {
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

// Show remove modal
export function showRemoveModal(packageName) {
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
export function showUpdateModal() {
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

// Add update terminal line
export function addUpdateTerminalLine(text, type = "normal") {
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
