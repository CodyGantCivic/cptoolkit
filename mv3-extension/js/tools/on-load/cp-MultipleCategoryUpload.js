(function loadTool() {
  var thisTool = "cp-MultipleCategoryUpload";
  chrome.storage.local.get(thisTool, function(settings) {
    if (chrome.runtime.lastError) {
      console.error("[CP Toolkit] Error loading settings for " + thisTool + ":", chrome.runtime.lastError);
      return;
    }
    detect_if_cp_site(function() {
      if (settings[thisTool] !== false) {
        console.log("[CP Toolkit] Loaded " + thisTool);
        try {

/**
 * Multiple Category Upload - Clean Modern Version

 * Adds a simple UI to create multiple categories on CivicPlus admin pages.
 * Supports: Info Center, Graphic Links, and Quick Links
 */

(function() {
  'use strict';

  const TOOLKIT_NAME = '[CP Toolkit - Multiple Categories]';

  /**
   * Helper to wait for a condition to become true before proceeding.
   */
  function waitFor(testFn, timeout = 8000, interval = 100) {
    const start = Date.now();
    return new Promise((resolve) => {
      (function check() {
        try {
          if (testFn()) return resolve(true);
        } catch (_) {
          // ignore errors in testFn
        }
        if (Date.now() - start >= timeout) return resolve(false);
        setTimeout(check, interval);
      })();
    });
  }

  /**
   * Initialize the Multiple Category Upload helper
   */
  async function init() {
    // Define the page paths this helper supports
    const path = (window.location.pathname || "").toLowerCase();
    const validPaths = [
      "/admin/infoii.aspx",
      "/admin/graphiclinks.aspx",
      "/admin/quicklinks.aspx",
    ];
    if (!validPaths.includes(path)) {
      // console.log(TOOLKIT_NAME + ' Not on a supported page');
      return;
    }

    // Wait for the "Add Category" button or link to exist
    const ready = await waitFor(() => {
      if (document.querySelector("input[value*='Add Category']")) return true;
      const anchors = Array.from(document.querySelectorAll("a"));
      return anchors.some((a) => /Add Category/i.test(a.textContent || ""));
    }, 10000);

    if (!ready) {
      // console.log(TOOLKIT_NAME + ' Add Category button not found');
      return;
    }

    // console.log(TOOLKIT_NAME + ' Initializing...');

    // Inject styles
    const styleContent = `
      /* Multiple Category Upload Modal Styles */
      #cp-mcu-modal {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        z-index: 2147483647;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
        font-family: Arial, Helvetica, sans-serif;
      }
      #cp-mcu-modal .cp-mcu-dialog {
        background: #fff; border-radius: 8px;
        width: 500px; max-width: 90vw; max-height: 90vh;
        display: flex; flex-direction: column;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      }
      #cp-mcu-modal .cp-mcu-header {
        padding: 16px 20px; border-bottom: 1px solid #e0e0e0;
        display: flex; align-items: center; justify-content: space-between;
      }
      #cp-mcu-modal .cp-mcu-header h3 {
        margin: 0; font-size: 18px; font-weight: 600; color: #333;
      }
      #cp-mcu-modal .cp-mcu-close-x {
        background: none; border: none; font-size: 24px; cursor: pointer; color: #666; padding: 0; line-height: 1;
      }
      #cp-mcu-modal .cp-mcu-close-x:hover { color: #333; }
      #cp-mcu-modal .cp-mcu-body {
        padding: 20px; overflow-y: auto; flex: 1;
      }
      .cp-mcu-section { margin-bottom: 10px; }
      .cp-mcu-section input, .cp-mcu-section select {
        width: 100%; margin-bottom: 4px; box-sizing: border-box;
        padding: 10px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;
      }
      .cp-mcu-section input:focus, .cp-mcu-section select:focus {
        outline: none; border-color: #af282f;
      }
      .cp-mcu-section label {
        font-size: 13px; font-weight: 500; color: #333;
      }
      .cp-mcu-row-actions { display: flex; gap: 8px; margin-top: 10px; }
      .cp-mcu-row-actions button {
        padding: 0px 16px; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;
        background: #e0e0e0; color: #333;
      }
      .cp-mcu-row-actions button:hover { background: #d0d0d0; }
      #cp-mcu-modal .cp-mcu-footer {
        padding: 16px 20px; border-top: 1px solid #e0e0e0;
        display: flex; justify-content: flex-end; gap: 8px;
      }
      #cp-mcu-modal .cp-mcu-footer button {
        padding: 0px 16px; border: none; border-radius: 4px; font-size: 14px; font-weight: 500; cursor: pointer;
      }
      #cp-mcu-modal #cp-mcu-cancel {
        background: #e0e0e0; color: #333;
      }
      #cp-mcu-modal #cp-mcu-cancel:hover { background: #d0d0d0; }
      #cp-mcu-modal #cp-mcu-submit {
        background: #af282f; color: #fff;
      }
      #cp-mcu-modal #cp-mcu-submit:hover { background: #c42f37; }
    `;
    const styleEl = document.createElement("style");
    styleEl.textContent = styleContent;
    document.head.appendChild(styleEl);

    // Build the modal structure
    const modal = document.createElement("div");
    modal.id = "cp-mcu-modal";
    modal.innerHTML = `
      <div class="cp-mcu-dialog">
        <div class="cp-mcu-header">
          <h3>Upload Multiple Categories</h3>
          <button type="button" class="cp-mcu-close-x" id="cp-mcu-close-x">&times;</button>
        </div>
        <div class="cp-mcu-body">
          <div id="cp-mcu-sections">
            <div class="cp-mcu-section">
              <input type="text" class="cp-mcu-name" placeholder="Category Name">
              <select class="cp-mcu-status">
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
          </div>
          <div class="cp-mcu-row-actions">
            <button type="button" id="cp-mcu-add">+ Add Row</button>
            <button type="button" id="cp-mcu-remove">- Remove Row</button>
          </div>
        </div>
        <div class="cp-mcu-footer">
          <button type="button" id="cp-mcu-cancel">Cancel</button>
          <button type="button" id="cp-mcu-submit">Submit</button>
        </div>
      </div>
    `;
    // Don't append yet — trigger button will append on click

    // Add button - adds new category section
    modal.querySelector("#cp-mcu-add").addEventListener("click", function () {
      const sections = modal.querySelector("#cp-mcu-sections");
      const div = document.createElement("div");
      div.className = "cp-mcu-section";
      div.innerHTML = `
        <input type="text" class="cp-mcu-name" placeholder="Category Name">
        <select class="cp-mcu-status">
          <option value="Draft">Draft</option>
          <option value="Published">Published</option>
        </select>
      `;
      sections.appendChild(div);
    });

    // Remove button - removes last section
    modal
      .querySelector("#cp-mcu-remove")
      .addEventListener("click", function () {
        const sections = modal.querySelectorAll(
          "#cp-mcu-sections .cp-mcu-section",
        );
        if (sections.length > 1) sections[sections.length - 1].remove();
      });

    // Close modal helper
    function closeModal() {
      modal.remove();
    }

    // Close button (x) - removes modal
    modal
      .querySelector("#cp-mcu-close-x")
      .addEventListener("click", closeModal);

    // Cancel button - removes modal
    modal.querySelector("#cp-mcu-cancel").addEventListener("click", closeModal);

    // Escape key closes modal
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.getElementById("cp-mcu-modal"))
        closeModal();
    });

    // Submit button - posts each category
    modal
      .querySelector("#cp-mcu-submit")
      .addEventListener("click", function () {
        const nameInputs = Array.from(modal.querySelectorAll(".cp-mcu-name"));
        const statusSelects = Array.from(
          modal.querySelectorAll(".cp-mcu-status"),
        );
        const tasks = [];

        // Read lngResourceID from the page's form instead of hardcoding
        const resourceIdInput = document.querySelector(
          'form[name="frmQLCategoryList"] input[name="lngResourceID"]',
        );
        const resourceId = resourceIdInput ? resourceIdInput.value : "43";

        // Read CSRF token from the page's form (required on some CMS versions)
        const csrfInput = document.querySelector(
          'form[name="frmQLCategoryList"] input[name="__RequestVerificationToken"]',
        );
        const csrfToken = csrfInput ? csrfInput.value : "";

        nameInputs.forEach(function (input, idx) {
          const name = input.value.trim();
          if (!name) return;

          const status = statusSelects[idx]
            ? statusSelects[idx].value
            : "Draft";
          const data = new URLSearchParams();
          data.append("lngResourceID", resourceId);
          data.append("strResourceType", "M");
          data.append("ysnSave", "1");
          data.append("intQLCategoryID", "0");
          data.append("strAction", "qlCategorySave");
          data.append("txtName", name);
          data.append("txtGroupViewList", "1");

          if (status === "Published") {
            data.append("ysnPublishDetail", "1");
          }

          if (csrfToken) {
            data.append("__RequestVerificationToken", csrfToken);
          }

          const postUrl = window.location.origin + path;
          tasks.push(
            fetch(postUrl, {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded; charset=UTF-8",
              },
              body: data.toString(),
              credentials: "same-origin",
            }),
          );
        });

        if (tasks.length) {
          // console.log(TOOLKIT_NAME + ' Submitting ' + tasks.length + ' categories...');
          Promise.allSettled(tasks).finally(function () {
            // console.log(TOOLKIT_NAME + ' All categories submitted - reloading');
            window.location.reload();
          });
        } else {
          closeModal();
        }
      });

    // Create trigger button
    let triggerButton;
    const addInput = document.querySelector("input[value*='Add Category']");

    if (addInput) {
      // Input-based button insertion
      triggerButton = document.createElement("input");
      triggerButton.type = "button";
      triggerButton.className = "cp-button";
      triggerButton.value = "Add Multiple Categories";
      triggerButton.style.marginLeft = "5px";
      addInput.insertAdjacentElement("afterend", triggerButton);
    } else {
      // Anchor-based button insertion
      const addAnchor = Array.from(document.querySelectorAll("a")).find((a) =>
        /Add Category/i.test(a.textContent || ""),
      );
      if (addAnchor) {
        triggerButton = document.createElement("li");
        const link = document.createElement("a");
        link.href = "#";
        link.className = "button bigButton nextAction cp-button";
        link.innerHTML = "<span>Add Multiple Categories</span>";
        triggerButton.appendChild(link);

        // Insert into the containing list
        let parent = addAnchor.parentElement;
        for (
          let i = 0;
          i < 3 && parent && parent.tagName.toLowerCase() !== "ul";
          i++
        ) {
          parent = parent.parentElement;
        }
        if (parent) {
          parent.insertBefore(triggerButton, parent.firstChild);
        }
        triggerButton = link;
      }
    }

    // Wire up trigger button to show modal
    if (triggerButton) {
      triggerButton.addEventListener("click", function (event) {
        event.preventDefault();
        // Remove old modal if lingering, then re-append a fresh one
        var old = document.getElementById("cp-mcu-modal");
        if (old) old.remove();

        // Reset sections to a single row
        var sections = modal.querySelector("#cp-mcu-sections");
        sections.innerHTML = `
          <div class="cp-mcu-section">
            <input type="text" class="cp-mcu-name" placeholder="Category Name">
            <select class="cp-mcu-status">
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
            </select>
          </div>
        `;
        document.body.appendChild(modal);
      });

      // console.log(TOOLKIT_NAME + ' Button added successfully');
    }
  }

  // Run initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

        } catch (err) {
          console.warn("[CP Toolkit](" + thisTool + ") Error:", err);
        }
      } else {
        // console.log("[CP Toolkit] ○ Skipping " + thisTool + " (disabled in settings)");
      }
    });
  });
})();
