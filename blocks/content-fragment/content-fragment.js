/*
 * Content Fragment Block
 * Renders an AEM Content Fragment on the page.
 * Fetches CF data via the AEM Assets HTTP API and renders the fields.
 */

const AEM_HOSTS = [
  'https://publish-p124869-e1429323.adobeaemcloud.com',
  'https://author-p124869-e1429323.adobeaemcloud.com',
];

/**
 * Extracts a clean /content/dam/... path from whatever the block contains.
 * The block may contain:
 *  - A full URL like https://...aem.page/content/dam/wknd-shared/...
 *  - A JCR path like /content/dam/wknd-shared/...
 *  - Just text like /content/dam/wknd-shared/...
 */
function extractCFPath(block) {
  const link = block.querySelector('a');
  const raw = link ? link.getAttribute('href') : block.textContent.trim();
  if (!raw) return null;

  let path = raw;

  // If it's a full URL, extract the pathname
  try {
    const url = new URL(raw, window.location.origin);
    path = url.pathname;
  } catch (e) {
    // use as-is
  }

  // Ensure it starts with /content/dam
  const damIdx = path.indexOf('/content/dam');
  if (damIdx >= 0) {
    return path.substring(damIdx);
  }

  // Maybe it's just the text without /content/dam prefix
  return path;
}

/**
 * Converts a /content/dam/... path to the Assets HTTP API path.
 * e.g. /content/dam/wknd-shared/en/contributors/kumar-selveraj
 *   -> wknd-shared/en/contributors/kumar-selveraj
 */
function toAssetApiPath(cfPath) {
  return cfPath.replace(/^\/content\/dam\//, '');
}

/**
 * Tries to fetch CF JSON from each AEM host in order.
 */
async function fetchCF(cfPath) {
  if (!cfPath) return null;

  const assetPath = toAssetApiPath(cfPath);

  for (const host of AEM_HOSTS) {
    try {
      const apiUrl = `${host}/api/assets/${assetPath}.json`;
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(apiUrl, {
        credentials: host.includes('author') ? 'include' : 'omit',
      });
      if (resp.ok) {
        // eslint-disable-next-line no-await-in-loop
        return await resp.json();
      }
    } catch (e) {
      // try next host
    }
  }

  return null;
}

/**
 * Renders a single CF element field.
 */
function renderElement(name, element) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('content-fragment-field');
  wrapper.dataset.field = name;

  const label = document.createElement('h3');
  label.textContent = element.title || name;
  wrapper.append(label);

  const { value, ':type': type } = element;

  if (value === undefined || value === null || value === '') return null;

  if (Array.isArray(value)) {
    const ul = document.createElement('ul');
    value.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    });
    wrapper.append(ul);
  } else if (type === 'text/html' || (typeof value === 'string' && value.trim().startsWith('<'))) {
    const content = document.createElement('div');
    content.innerHTML = value;
    wrapper.append(content);
  } else {
    const p = document.createElement('p');
    p.textContent = String(value);
    wrapper.append(p);
  }

  return wrapper;
}

export default async function decorate(block) {
  const cfPath = extractCFPath(block);

  // Clear the block content (remove the link/button)
  block.textContent = '';

  if (!cfPath) {
    block.textContent = 'No content fragment reference provided.';
    return;
  }

  const loading = document.createElement('p');
  loading.textContent = 'Loading content fragment…';
  block.append(loading);

  const data = await fetchCF(cfPath);
  block.textContent = '';

  if (!data) {
    block.innerHTML = `<p class="content-fragment-error">
      Could not load content fragment: <code>${cfPath}</code>
    </p>`;
    return;
  }

  const props = data.properties || {};

  // Render title
  const title = props.title || props['dc:title'] || data.title || '';
  if (title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    block.append(h2);
  }

  // Render description
  const description = props.description || props['dc:description'] || '';
  if (description) {
    const p = document.createElement('p');
    p.classList.add('content-fragment-description');
    p.textContent = description;
    block.append(p);
  }

  // Render CF model elements
  const elements = props.elements || {};
  const keys = Object.keys(elements);

  if (keys.length > 0) {
    const fieldsContainer = document.createElement('div');
    fieldsContainer.classList.add('content-fragment-fields');

    keys.forEach((key) => {
      const el = renderElement(key, elements[key]);
      if (el) fieldsContainer.append(el);
    });

    block.append(fieldsContainer);
  }

  // If nothing rendered at all (no title, no elements), show the raw JSON
  if (block.children.length === 0) {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    block.append(pre);
  }
}
