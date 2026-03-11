function _fallbackCopyToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand("copy");
    const msg = successful ? "successful" : "unsuccessful";
    console.log("Fallback: Copying text command was " + msg);
  } catch (err) {
    console.error("Fallback: Oops, unable to copy", err);
  }

  document.body.removeChild(textArea);
}

function copyToClipboard(text) {
  if (!navigator.clipboard) {
    _fallbackCopyToClipboard(text);
    return;
  }

  navigator.clipboard.writeText(text).then(
    function() {
      console.log("Async: Copying to clipboard was successful!");
    },
    function(err) {
      console.error("Async: Could not copy text: ", err);
      _fallbackCopyToClipboard(text);
    }
  );
}

function copyLinks() {
  const sel = getSelection();

  // Check if there's actually a selection
  if (!sel || sel.rangeCount === 0) {
    alert("[CP Toolkit] Please select some text containing links first.");
    return;
  }

  const range = sel.getRangeAt(0);

  // Handle case where selection is just text (no container with querySelectorAll)
  const container = range.commonAncestorContainer;
  const searchElement = container.nodeType === Node.ELEMENT_NODE
    ? container
    : container.parentElement;

  if (!searchElement) {
    alert("[CP Toolkit] Could not find links in selection.");
    return;
  }

  const elems = searchElement.querySelectorAll("a");
  const links = [...elems].filter(
    (elem) => sel.containsNode(elem) || elem.contains(sel.anchorNode) || elem.contains(sel.extentNode)
  );

  if (links.length === 0) {
    alert("[CP Toolkit] No links found in selection.");
    return;
  }

  const details = links.map((elem) => [elem.innerText.trim(), elem.href]);
  copyToClipboard(JSON.stringify(details));
  alert("[CP Toolkit] Copied " + links.length + " link(s) to clipboard.");
}

copyLinks();
