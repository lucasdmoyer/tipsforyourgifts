export const publicEnhancementsSource = `const siteOrigin = 'https://tipsforyourgifts.web.app';

function shareStatus(button, message) {
  const card = button.closest('.article-share-card');
  const status = card?.querySelector('.article-share-status');
  if (status) status.textContent = message;
}

async function shareArticle(button) {
  const slug = button.dataset.articleSlug;
  if (!slug) return;
  const url = siteOrigin + '/blog/' + slug;
  const preferNative = button.dataset.shareMethod === 'native_or_copy';
  if (preferNative && navigator.share) {
    try {
      await navigator.share({ title: document.title, text: document.querySelector('meta[name="description"]')?.content ?? '', url });
      shareStatus(button, 'Shared.');
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  if (!navigator.clipboard?.writeText) {
    shareStatus(button, "Copy this page's address from your browser.");
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    shareStatus(button, 'Link copied.');
  } catch {
    shareStatus(button, "Copy this page's address from your browser.");
  }
}

for (const button of document.querySelectorAll('[data-event-name="article_share"]')) {
  button.addEventListener('click', () => shareArticle(button));
}
`;

export function isInteractiveRoute(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  return normalized === 'gift-finder/index.html' || normalized.startsWith('studio/');
}

export function optimizeStaticPublicHtml(html, enhancementScriptPath) {
  let result = html
    .replaceAll('<!--nghm-->', '')
    .replace(/<link\b[^>]*\brel="modulepreload"[^>]*>\s*/g, '')
    .replace(/<script\b[^>]*\bsrc="(?:\.\/|\/)?main-[A-Z0-9]+\.js"[^>]*><\/script>\s*/g, '')
    .replace(/<script\b[^>]*\bid="ng-state"[^>]*>[\s\S]*?<\/script>\s*/g, '')
    .replace(/\sngh="[^"]*"/g, '')
    .replace(/\sng-version="[^"]*"/g, '')
    .replace(/\sng-server-context="[^"]*"/g, '')
    .replace(/\srouterlink(?:active)?="[^"]*"/g, '');

  if (result.includes('data-event-name="article_share"') && !result.includes(enhancementScriptPath)) {
    result = result.replace('</body>', `  <script src="${enhancementScriptPath}" type="module"></script>\n</body>`);
  }
  return result;
}
