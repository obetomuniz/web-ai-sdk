// Reset the search modal when it closes: clear the query (and with it the
// results drawer) so reopening always starts from a fresh, focused field —
// Starlight already focuses the input on open, but keeps the previous query.
// The open-attribute observer backs up the close event for engines/embeds
// that don't deliver it reliably.
const dialog = document.querySelector("site-search dialog");

const reset = () => {
  if (dialog?.open) return;
  const input = dialog?.querySelector(".pagefind-ui__search-input");
  if (input instanceof HTMLInputElement && input.value) {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

if (dialog) {
  dialog.addEventListener("close", reset);
  new MutationObserver(reset).observe(dialog, {
    attributes: true,
    attributeFilter: ["open"],
  });
}
