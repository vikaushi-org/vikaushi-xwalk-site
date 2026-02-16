/*
 * Content Fragment Block
 * Renders an AEM Content Fragment on the page.
 * Fetches CF data via the AEM Assets HTTP API and renders the fields.
 */

const AEM_AUTHOR = 'https://author-p124869-e1429323.adobeaemcloud.com';
const AEM_PUBLISH = 'https://publish-p124869-e1429323.adobeaemcloud.com';

/**
 * Extracts the CF path from a link href or text content.
 * Handles both full URLs and JCR paths.
 * @param {string} raw - The raw path or URL
 * @returns {string} The clean JCR path
 */
function extractPath(raw) {
  let path = raw.trim();
  try {
    const url = new URL(path);
    path = url.pathname;
  } catch (e) {
    // not a URL, use as-is
  }
  return path;
}

/**
 * Fetches a Content Fragment via the Assets HTTP API.
 * The API path strips /content/dam and appends .json.
 * e.g. /content/dam/wknd-shared/en/contributors/kumar-selveraj
 *   -> /api/assets/wknd-shared/en/contributors/kumar-selveraj.json
 * @param {string} cfPath - The JCR path to the content fragment
 * @returns {object|null} The CF JSON data
 */
async function fetchCF(cfPath) {
  if (!cfPath) return null;

  const assetPath = cfPath.replace(/^\/content\/dam\//, '');
  const apiUrl = `${AEM_PUBLISH}/api/assets/${assetPath}.json`;

  const resp = await fetch(apiUrl, { credentials: 'omit' });
  if (resp.ok) {
    return resp.json();
  }

  // Fallback: try author (for preview/dev with credentials)
  const authorResp = await fetch(
    `${AEM_AUTHOR}/api/assets/${assetPath}.json`,
    { credentials: 'include' },
  );
  if (authorResp.ok) {
    return authorResp.json();
  }

  return null;
}

/**
 * Renders a single CF field as an HTML element.
 */
function renderField(label, value, dataType) {
  const div = document.createElement('div');
  div.classList.add('content-fragment-field');

  const dt = document.createElement('dt');
  dt.textContent = label || '';
  const dd = document.createElement('dd');

  if (Array.isArray(value)) {
    const ul = document.createElement('ul');
    value.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    });
    dd.append(ul);
  } else if (dataType === 'text/html' || (typeof value === 'string' && value.startsWith('<'))) {
    dd.innerHTML = value;
  } else if (value !== undefined && value !== null && value !== '') {
    dd.textContent = value;
  }

  div.append(dt, dd);
  return div;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const raw = link ? link.getAttribute('href') : block.textContent.trim();
  const cfPath = extractPath(raw);

  if (!cfPath || !cfPath.startsWith('/content/dam')) {
    return;
  }

  block.textContent = '';
  block.classList.add('loading');

  const data = await fetchCF(cfPath);
  block.classList.remove('loading');

  if (!data || !data.properties) {
    const msg = document.createElement('p');
    msg.classList.add('content-fragment-error');
    msg.textContent = 'Content fragment could not be loaded.';
    block.append(msg);
    return;
  }

  const { properties } = data;

  // Title
  const title = properties.title || properties['jcr:title'] || '';
  if (title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    block.append(h2);
  }

  // Description
  if (properties.description) {
    const desc = document.createElement('p');
    desc.classList.add('content-fragment-description');
    desc.textContent = properties.description;
    block.append(desc);
  }

  // CF fields from the "elements" object
  const elements = properties.elements || {};
  const fieldList = document.createElement('dl');
  fieldList.classList.add('content-fragment-fields');

  Object.entries(elements).forEach(([, field]) => {
    const label = field.title || field[':type'] || '';
    const { value } = field;
    const dataType = field[':type'] || '';
    if (value !== undefined && value !== null && value !== '') {
      fieldList.append(renderField(label, value, dataType));
    }
  });

  if (fieldList.children.length > 0) {
    block.append(fieldList);
  }
}
