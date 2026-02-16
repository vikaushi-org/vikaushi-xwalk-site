/*
 * Content Fragment Block
 * Renders an AEM Content Fragment on the page.
 * Fetches CF data from the AEM author/publish Assets HTTP API.
 */

/**
 * Extracts a /content/dam/... path from the block's link or text.
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

  // Strip trailing .html
  path = path.replace(/\.html$/, '');

  // Find /content/dam in the path
  const damIdx = path.indexOf('/content/dam/');
  if (damIdx >= 0) {
    return path.substring(damIdx);
  }

  return path;
}

/**
 * Converts /content/dam/... to the Assets API sub-path.
 */
function toApiPath(cfPath) {
  return cfPath.replace(/^\/content\/dam\//, '');
}

/**
 * Fetches the CF JSON. In the Universal Editor (author domain), fetch from
 * the same origin. On the published EDS site, try publish then author.
 */
async function fetchCF(cfPath) {
  if (!cfPath) return null;

  const apiSubPath = toApiPath(cfPath);

  // When running inside the UE or on the author domain, same-origin works
  const sameOriginUrl = `/api/assets/${apiSubPath}.json`;
  try {
    const resp = await fetch(sameOriginUrl, { credentials: 'same-origin' });
    if (resp.ok) {
      const data = await resp.json();
      if (data.properties) return data;
    }
  } catch (e) {
    // not on author, try cross-origin
  }

  // Cross-origin attempts for EDS preview/live
  const hosts = [
    'https://publish-p124869-e1429323.adobeaemcloud.com',
    'https://author-p124869-e1429323.adobeaemcloud.com',
  ];

  for (const host of hosts) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const resp = await fetch(`${host}/api/assets/${apiSubPath}.json`, {
        credentials: host.includes('author') ? 'include' : 'omit',
      });
      // eslint-disable-next-line no-await-in-loop
      if (resp.ok) return await resp.json();
    } catch (e) {
      // try next
    }
  }

  return null;
}

/**
 * Renders a CF element field.
 */
function renderElement(name, element) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('content-fragment-field');
  wrapper.dataset.field = name;

  const label = document.createElement('h3');
  label.textContent = element.title || name;
  wrapper.append(label);

  const val = element.value;
  const type = element[':type'] || '';

  if (val === undefined || val === null || val === '') return null;

  if (Array.isArray(val)) {
    const ul = document.createElement('ul');
    val.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    });
    wrapper.append(ul);
  } else if (type === 'text/html' || (typeof val === 'string' && val.trim().startsWith('<'))) {
    const content = document.createElement('div');
    content.innerHTML = val;
    wrapper.append(content);
  } else {
    const p = document.createElement('p');
    p.textContent = String(val);
    wrapper.append(p);
  }

  return wrapper;
}

export default async function decorate(block) {
  const cfPath = extractCFPath(block);

  block.textContent = '';

  if (!cfPath) {
    block.textContent = 'No content fragment reference provided.';
    return;
  }

  const loading = document.createElement('p');
  loading.textContent = 'Loading…';
  block.append(loading);

  const data = await fetchCF(cfPath);
  block.textContent = '';

  if (!data) {
    block.innerHTML = `<p class="content-fragment-error">
      Could not load content fragment: <code>${cfPath}</code><br>
      <small>Ensure the content fragment is published, or view this page in the Universal Editor.</small>
    </p>`;
    return;
  }

  const props = data.properties || {};
  const title = props.title || props['dc:title'] || data.title || '';
  if (title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    block.append(h2);
  }

  if (props.description) {
    const p = document.createElement('p');
    p.classList.add('content-fragment-description');
    p.textContent = props.description;
    block.append(p);
  }

  const elements = props.elements || {};
  const keys = Object.keys(elements);
  if (keys.length > 0) {
    const container = document.createElement('div');
    container.classList.add('content-fragment-fields');
    keys.forEach((key) => {
      const el = renderElement(key, elements[key]);
      if (el) container.append(el);
    });
    block.append(container);
  }

  // Fallback: if nothing rendered, show raw data
  if (block.children.length === 0) {
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    block.append(pre);
  }
}
