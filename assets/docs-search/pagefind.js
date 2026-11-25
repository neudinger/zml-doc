import { createInstance as createPagefind } from "../pagefind/pagefind.js";

const sectionNames = {
  "user-guide": "User Guide",
  "developer-guide": "Developer Guide",
  "api-reference": "API Reference",
  "cli-reference": "CLI Reference",
};
const titleFilter = "page_title";

function titleKey(title) {
  return title.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function resultContext(url, basePath) {
  const path = new URL(url, document.baseURI).pathname;
  if (!path.startsWith(basePath)) return "";
  const [product, section, group] = path.slice(basePath.length).split("/");
  if (product !== "zml" && product !== "llmd") return "";
  const labels = [product.toUpperCase(), sectionNames[section]];
  if (group === "operations") labels.push("Operations");
  return labels.filter(Boolean).join(" / ");
}

// Pagefind's component loads this module through its configured bundle path.
// Keep its renderer, result fragments, and keyboard handling on the same instance.
export function createInstance(options) {
  const pagefind = createPagefind(options);
  const basePath = new URL(options?.baseUrl ?? "/", document.baseURI).pathname;
  let titles = new Map();

  async function filters() {
    const available = await pagefind.filters();
    titles = new Map();
    for (const title of Object.keys(available[titleFilter] ?? {})) {
      const key = titleKey(title);
      const values = titles.get(key) ?? [];
      values.push(title);
      titles.set(key, values);
    }
    return available;
  }

  async function search(query, searchOptions = {}) {
    const matchingTitles = typeof query === "string" ? titles.get(titleKey(query)) : undefined;
    const exactLookup = matchingTitles
      ? pagefind.search(null, {
          filters: { all: [searchOptions.filters ?? {}, { [titleFilter]: { any: matchingTitles } }] },
        }).catch(() => null)
      : null;
    const [response, exact] = await Promise.all([pagefind.search(query, searchOptions), exactLookup]);
    const exactIds = new Set(exact?.results.map(result => result.id));
    const priority = [];
    const related = [];

    for (const result of response.results) {
      const exactTitle = exactIds.has(result.id);
      const group = exactTitle ? priority : related;
      group.push({
        ...result,
        async data() {
          const data = await result.data();
          return {
            ...data,
            meta: {
              ...data.meta,
              exact_title: exactTitle,
              search_context: resultContext(data.url, basePath),
            },
          };
        },
      });
    }
    return { ...response, results: [...priority, ...related] };
  }

  return { ...pagefind, filters, search };
}
