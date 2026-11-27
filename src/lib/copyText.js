// Copies text to the clipboard, falling back to a hidden input for older browsers.
// Resolves true when the text was copied, false otherwise.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const input = document.createElement('input');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    try {
      input.select();
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      input.remove();
    }
  }
}
