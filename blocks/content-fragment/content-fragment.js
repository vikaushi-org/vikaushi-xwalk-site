/*
 * Content Fragment Block
 * Renders an AEM Content Fragment on the page.
 * https://www.aem.live/developer/block-collection/content-fragment
 */

const defined = (value) => value !== undefined && value !== null && value !== '';

function renderField(name, value) {
  const div = document.createElement('div');
  div.classList.add('content-fragment-field');
  div.dataset.field = name;

  if (Array.isArray(value)) {
    const ul = document.createElement('ul');
    value.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      ul.append(li);
    });
    div.append(ul);
  } else if (typeof value === 'string' && value.startsWith('<')) {
    div.innerHTML = value;
  } else if (defined(value)) {
    const p = document.createElement('p');
    p.textContent = value;
    div.append(p);
  }

  return div;
}

async function fetchContentFragment(path) {
  if (!path) return null;

  const cfPath = path.replace(/^\/content\/dam/, '');
  const resp = await fetch(`${cfPath}.cfm.gql.json`);
  if (resp.ok) {
    return resp.json();
  }

  const fallback = await fetch(`${cfPath}.json`);
  if (fallback.ok) {
    return fallback.json();
  }

  return null;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link
    ? link.getAttribute('href')
    : block.textContent.trim();

  if (!path) return;

  block.textContent = '';

  const data = await fetchContentFragment(path);
  if (!data) {
    block.textContent = '';
    return;
  }

  const fields = data.fields || data.properties || data;
  const title = data.title || fields.title || fields.name;

  if (title) {
    const h2 = document.createElement('h2');
    h2.textContent = title;
    block.append(h2);
  }

  if (typeof fields === 'object' && !Array.isArray(fields)) {
    Object.entries(fields).forEach(([name, value]) => {
      if (name.startsWith('cq:') || name.startsWith('jcr:') || name === 'title') return;
      block.append(renderField(name, value));
    });
  }
}
