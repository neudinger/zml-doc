# Summary: ZML and LLMD documentation proposal

## Main recommendation

Reuse the core of the existing ZAST documentation site to create one static site for **Run models**, **Build with ZML**, and **Operate deployments**. Keep Zine, SuperMD, and SuperHTML for the first version. Author explanations and guides in the website repository, and import selected reference material from pinned upstream sources.

The three journeys should link to shared canonical pages rather than duplicate documentation for each audience. A reader connecting to an existing LLMD endpoint should have a direct route that does not require learning Zig or Bazel.

## Products and audience needs

| Product | Role | Main documentation needs |
| --- | --- | --- |
| ZML | Inference framework and model compilation machinery | First example, tensors, model lifecycle, model implementation, weights, compilation, and API reference |
| ZML examples | Runnable applications in the framework repository | Build/run instructions, backend selection, weights, and code explanations |
| LLMD | Model inference server | Installation, model selection, readiness, first request, integration, deployment, and operations |
| zml-smi | Hardware diagnostics and monitoring | Hardware inspection, output formats, monitoring, troubleshooting, and versioned CLI reference |
| zml-lab | Unofficial macOS desktop workbench | Server connections, benchmarks, comparisons, reports, and exported runs |

Compatibility should be recorded per **product → version → OS/architecture → accelerator → model/precision → verification status**. Support in one product does not imply support in another, and model availability does not prove every backend combination has been tested.

## Architecture and content ownership

Reuse the ZAST page shell, reading styles, separate website repository, and validation tooling. Adapt navigation and generated-content integration to ZML rather than carrying over ZAST-specific extraction or Wasm behavior.

The central architectural requirement is to **separate documentation builds from expensive execution work**. Editing prose should not compile ZML, download models, or need accelerator hardware. Upstream imports, example compilation, environment validation, and recording capture should produce artifacts that normal website builds consume.

Suggested repository areas are `content/`, `layouts/`, `examples/`, `recipes/`, `assets/recordings/`, `generated/`, and `tools/`, with pinned inputs in `upstream.lock.json`.

Humans should maintain tutorials, explanations, operational procedures, troubleshooting, and interpretation of results. Generate material whose exact content comes from source: code snippets, public signatures, CLI help, configuration fields, and version data. Imported prose still needs review; the site should not become an automatic mirror of upstream Markdown.

Add documentation sidebars, page tables of contents, product context, and Pagefind search. Static search can index rendered content; dynamically loaded API symbols require an additional index or export.

## Recipes as the reusable content unit

A recipe connects an explanation to runnable files or scripts, prerequisites, numbered steps, expected output, troubleshooting, a next step, and optional demonstrations.

Every executable recipe should identify its product version, upstream commit or container digest, model revision and precision where relevant, tested host/accelerator/driver, verification date, and evidence. Distinguish **source reviewed**, **executed**, and **experimental**. A website rebuild must not automatically change verification dates.

Command blocks should declare the shell, working directory, and required substitutions. Copy buttons should copy executable commands without prompts or expected output. Code excerpts should link to complete runnable files.

The first ZML tutorial should explain the stages of running MNIST. The first LLMD tutorial should cover the entire cycle: installation, model loading, readiness, the exposed model name, a request, and a successful response.

## Demonstrations and browser interactivity

Use self-hosted **asciinema** recordings for terminal procedures, with controls, no autoplay or looping, transcripts, commands, and environment details. Keep guides understandable without playback. Distinguish compressed playback idle time from real startup or compilation duration.

Use screenshots or screen video for zml-lab because terminal recordings cannot capture its graphical interface. The source document reports that Atuin Desktop was archived on 30 September 2026; it recommends versioned scripts and documentation as the maintained runbook format, with Atuin material optional.

Introduce interactivity in stages:

1. **MVP:** a guided example or command builder driven by verified recipe definitions.
2. **Later:** an explorer for recorded benchmark runs, potentially using zml-lab's `.jsonl.gz` format and DuckDB-WASM. Explain metric definitions and token-counting methods.
3. **Separate future project:** real inference through a hosted service or deliberate user-owned runtime connection, with access management, limits, and cancellation.

The ZAST Wasm playground is a design reference, not a general-purpose browser Zig compiler. Static hosting can serve documentation and browser features; hosted inference needs a separate service.

## First release and publishing checks

The proposed first release contains approximately **10–12 substantial pages, four or five demonstrations, and one small interactive feature**. Cover ecosystem orientation, configuration selection, ZML first run and model concepts, LLMD installation and first request, operations, troubleshooting, zml-smi, zml-lab, and compatibility.

Implement the foundation first, then navigation and reusable components, core recipes, operator/tool guides, and finally the initial playground. Begin with a current documented snapshot; defer historical documentation until incompatible versions justify it.

Use three independent verification levels:

- **Documentation:** build, links, anchors, IDs, routes, assets, metadata, snippet references, and search output.
- **Examples:** compile relevant examples and run practical lightweight checks.
- **Environments:** execute recipes on the specific configurations they claim to support.

Pin upstream inputs and make pull-request checks explicit. The main acceptance test is whether a new recipe can include explanations, executable commands, expected results, and a recording without layout changes or rebuilding the inference stack.

## Evidence limits

The supplied document reports source and official-documentation research available on **5 November 2026**. Its ZAST reuse assessment is based on repository source because the rendered site could not be retrieved. It did not execute model workloads or perform hardware and visual validation. Release requirements, compatibility details, and tool-status claims must therefore be rechecked when implementing the site.
