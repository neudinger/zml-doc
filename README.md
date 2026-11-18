# ZML documentation site

Static documentation built with Zine, SuperMD, and SuperHTML. The base site
contains the Build with ZML and Serve models with LLMD entry paths. The
documentation tabs select a product sidebar, with Operations under LLMD.
The implementation roadmap is in [plan.md](plan.md).

## Requirements

- **Zig 0.17.0**, enforced by the build.
- **Pagefind 1.6.0** on `PATH` for builds that generate `dist/`. [Native binaries](https://github.com/pagefind/pagefind/releases/tag/v1.6.0)
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

`zig build serve` starts Zine at <http://127.0.0.1:1990/> with live reload for
content, layout, and asset edits. Stop it with Ctrl+C. Restart after changing
native tools or dependencies. To preview the indexed site with search enabled,
run `zig build` and serve `dist/` over HTTP. With the default site prefix, use
`pagefind --site dist --serve` and open the URL printed by Pagefind.

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
| `content/` | Authored SuperMD pages: Start, ZML, LLMD, Operations; reserved Tools, Recipes, and Reference sections |
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

Create `content/<section>/<slug>.smd`:

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
`[Start]($link.page('start'))` and site asset references instead of hard-coding a
deployment prefix. Assets are published when referenced; static asset directories
can be declared explicitly in `zine.ziggy` when needed.

Add each documentation page to its reading order in
[`assets/docs-navigation.ziggy`](assets/docs-navigation.ziggy). Its position
sets the Previous and Next destinations. Its group, label, and icon set its
sidebar entry. Operations pages belong to the LLMD reading order.

## Validation and scope

The build checks local links and fragments, duplicate HTML IDs, a single H1 per
page, duplicate routes, page/asset collisions, and missing assets. The native
validator inspects Zine's generated, double-quoted `id`, `href`, and `src`
attributes; it is not a general HTML, CSS URL, or external-link checker.

**Search docs** covers ZML, LLMD, Operations, Start, and shared reference pages.
The article layout marks the content to index. Navigation and the homepage are
outside the index. Recipe components, recordings, upstream imports, API
generation, and the command builder are subsequent roadmap work.

## Attribution

Generic build validation and filesystem helpers are adapted from the local
ZAST site. See [NOTICE.md](NOTICE.md) and [LICENSE](LICENSE).
