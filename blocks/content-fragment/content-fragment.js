/*
 * Content Fragment Block
 * Include an AEM Content Fragment or Experience Fragment on the page.
 * Fetches the fragment as a page via .plain.html and renders its content inline.
 */

// eslint-disable-next-line import/no-cycle
import {
  decorateMain,
} from '../../scripts/scripts.js';

import {
  loadSections,
} from '../../scripts/aem.js';

/**
 * Loads a content/experience fragment by path.
 * @param {string} path The path to the fragment
 * @returns {HTMLElement|null} The root element of the fragment
 */
async function loadContentFragment(path) {
  if (!path) return null;

  // Normalize: strip .html suffix if present
  // eslint-disable-next-line no-param-reassign
  path = path.replace(/(\.plain)?\.html$/, '');

  const resp = await fetch(`${path}.plain.html`);
  if (resp.ok) {
    const main = document.createElement('main');
    main.innerHTML = await resp.text();

    // Reset base path for media to fragment base
    const resetAttributeBase = (tag, attr) => {
      main.querySelectorAll(`${tag}[${attr}^="./media_"]`).forEach((elem) => {
        elem[attr] = new URL(elem.getAttribute(attr), new URL(path, window.location)).href;
      });
    };
    resetAttributeBase('img', 'src');
    resetAttributeBase('source', 'srcset');

    decorateMain(main);
    await loadSections(main);
    return main;
  }
  return null;
}

export default async function decorate(block) {
  const link = block.querySelector('a');
  const path = link ? link.getAttribute('href') : block.textContent.trim();
  const fragment = await loadContentFragment(path);
  if (fragment) {
    const fragmentSection = fragment.querySelector(':scope .section');
    if (fragmentSection) {
      block.classList.add(...fragmentSection.classList);
      block.classList.remove('section');
      block.replaceChildren(...fragmentSection.childNodes);
    }
  }
}
