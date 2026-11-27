# ZML documentation site

Static documentation built with Zine, SuperMD, and SuperHTML. The homepage
links directly to the ZML overview and LLMD Quickstart.
Both products use Tutorials, How To, Learn, and Reference, with separate sidebars.
The implementation roadmap is in [plan.md](plan.md).

## Requirements

- **Zig 0.17.0**, enforced by the build.
- Network access on the first build to obtain the pinned documentation dependencies.

Zine and its transitive packages provide SuperMD and SuperHTML. The exact Zine
revision and package hash are pinned in [build.zig.zon](build.zig.zon). The build
does not require a ZML checkout, Bazel, model weights, an accelerator, Node, or a
separately installed Zine executable.

## Build and preview

```sh
zig build
zig build serve
zig build check
zig build test
```

`zig build` renders to a staging directory, generates the Pagefind bundle in
`pagefind/`, and validates the site before replacing `dist/`. A failed render,
index, or validation preserves the last valid output. Stale output files
disappear on a successful replacement.

`zig build serve` builds the site and Pagefind index, then starts Zine at
<http://127.0.0.1:1990/> with search and live reload for content, layout, and asset
edits. The search index stays as it was at startup, so results may be outdated
after edits. Restart to refresh search or after changing native tools or
dependencies. Stop it with Ctrl+C.

`zig build check` explicitly rebuilds and validates the output. `zig build test`
also checks failure cases and preservation of the previous build.

## Publish to GitHub Pages

Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
Run **Deploy GitHub Pages** from the **Actions** tab on `main`. The workflow
builds and tests the site using the configured Pages URL, then deploys `dist/`
including the Pagefind search index. Local builds use the URL in `zine.ziggy`.

## Directory layout

| Directory or file | Purpose |
| --- | --- |
| `content/` | Homepage, ZML and LLMD guides and references, and LLMD Operations pages |
| `layouts/` | Shared SuperHTML content layout and base template |
| `assets/` | CSS, favicon, and future published recordings |
| `examples/` | Complete runnable example files, checked separately |
| `recipes/` | Versioned procedure scripts and recipe metadata |
| `generated/` | Reviewed reference snapshots and snippets |
| `tools/` | Native build coordinator, validation, and focused tests |
| `upstream.lock.json` | Documentation toolchain pins and future upstream artifact identities |
| `dist/` | Generated static site; ignored by version control |

Reserved content sections contain `.gitkeep` files and do not appear in
navigation until they contain useful pages. `examples/`, `recipes/`, and
`generated/` are not scanned or executed by the documentation build. No product
revision or hardware verification is claimed yet.

## Add a page

Use `tutorial/`, `howto/`, `learn/`, and `reference/` under `content/zml/`
and `content/llmd/`. Use lowercase hyphenated slugs for LLMD pages. Each
product's landing page is its `index.smd`.

```text
---
.title = "Page title",
.description = "What the reader will learn.",
.date = .date("2026-11-06T00:00:00"),
.layout = "content.shtml",
---
Opening paragraph.

# First section

Section content.
```

The layout supplies the page's single H1. With `headings_h2` enabled, body `#`
headings render as H2. Use a stable ID such as
`# [First section]($heading.id('first-section'))` to link an article heading
from the **On this page** list. Use Zine page links such as
`[Build with ZML]($link.page('zml'))` and site asset references instead of hard-coding a
deployment prefix. Assets are published when referenced; static asset directories
can be declared explicitly in `zine.ziggy` when needed.

Set `custom.doc_section` to the section label in the page front matter. Add the page
to a group under its product and section in
[`assets/docs-navigation.ziggy`](assets/docs-navigation.ziggy). Each section’s
first page is its header tab destination. The sidebar and Previous/Next follow
the same group and page order within that section. Put LLMD operations pages
in the How To section’s Operations group. Article headings supply the anchors for
the On this page navigation.

Edit [Hardware compatibility](content/zml/reference/hardware-compatibility.smd) and
[Environment variables](content/zml/reference/environment-variables.smd) in their source articles.
Both topics are listed in the ZML Reference. In LLMD, Hardware compatibility
supports the Quickstart and Environment variables is in the CLI Reference.
Product views share the source content through `reference_source`, and Pagefind
indexes both views.

## Validation and scope

The build checks local links and fragments, duplicate HTML IDs, a single H1 per
page, duplicate routes, page/asset collisions, and missing assets. The native
validator inspects Zine's generated, double-quoted `id`, `href`, and `src`
attributes; it is not a general HTML, CSS URL, or external-link checker.

**Search docs** covers ZML and LLMD, including Operations. Reference results
include the product name so readers can open the corresponding navigation.
The article layout marks the content to index. Navigation and the homepage are
outside the index.
Recipe components, recordings, API generation, and the command builder are
subsequent roadmap work.

## Attribution

Generic build validation and filesystem helpers are adapted from the local
ZAST site. See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).
