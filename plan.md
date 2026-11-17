# ZML documentation site: MVP plan

## Objective and scope

Build one static documentation site with three entry paths: **Run models**, **Build with ZML**, and **Operate deployments**. Reuse the ZAST site's Zine, SuperMD, SuperHTML, and validation foundation. Keep shared guides canonical so the entry paths link to the same content.

Target approximately **12 substantial pages, four focused demonstrations, and one command builder**. Start with one verified LLMD deployment configuration and one verified ZML example configuration. Expand platform coverage only after testing it.

The work below is ordered by dependency. Each step has an observable completion condition.

## 1. Adapt the foundation and separate the builds

- Bring over the reusable ZAST site shell and validation tooling; remove ZAST-specific API, catalogue, and Wasm assumptions.
- Establish `content/`, `layouts/`, `examples/`, `recipes/`, `assets/recordings/`, `generated/`, and `tools/`.
- Add `upstream.lock.json` for pinned source revisions, release identities, and artifact references. Record the documentation toolchain versions.
- Separate normal documentation build/preview from upstream imports, API generation, example compilation, hardware execution, and recording capture. The normal build consumes checked artifacts.
- Preserve validation of local links, fragments, duplicate IDs, routes, assets, and output before replacing the previous build.

**Done when:** a clean checkout can build and preview an authored page using only documentation dependencies, without compiling ZML, downloading models, or requiring an accelerator.

## 2. Build the documentation navigation and reading experience

- Add the three task entry paths, product context, documentation sidebars, and page tables of contents.
- Organize canonical content under Start, ZML, LLMD, Operations, Tools, Recipes, and Reference; expose only populated sections.
- Distinguish tutorials, how-to guides, explanations, and reference pages in page metadata.
- Add Pagefind search across rendered guides and static reference content. Link to upstream API documentation initially; defer unified API-symbol search unless a static index is available.
- Add responsive layouts, keyboard-accessible navigation, and reusable presentation for commands, code excerpts, expected output, and complete-file downloads.

**Done when:** readers can enter through each journey, navigate between products without losing context, and find published content through search on desktop and mobile.

## 3. Define reusable recipes, provenance, and demonstrations

- Define stable recipe identifiers and explicit source references. Each recipe records its goal, prerequisites, commands or source files, expected result, troubleshooting, and next step.
- Record product version, source commit or container digest, model revision and precision where relevant, host, accelerator, driver, verification date, and evidence.
- Use the statuses **source reviewed**, **executed**, and **experimental**. An executed claim applies only to its recorded environment; normal builds must not advance verification dates.
- Make command blocks declare shell, working directory, and substitutions. Copy controls must exclude prompts, line numbers, and expected output.
- Embed self-hosted asciinema recordings with visible controls, no autoplay or looping, transcripts, and environment information. Keep every procedure usable without playback; show actual startup or compilation duration separately when playback compresses idle time.
- Use screenshots or screen video for the graphical zml-lab application. Keep maintained scripts as the executable format rather than depending on Atuin Desktop.

**Done when:** a sample recipe can render commands, expected output, source downloads, verification details, and a recording without custom layout changes.

## 4. Complete the orientation, ZML, and LLMD journeys

Write eight initial pages:

1. Ecosystem overview and path selection: distinguish ZML, framework examples, LLMD, zml-smi, and zml-lab.
2. Configuration selection: explain requirements and link to the shared compatibility reference.
3. ZML first run: execute the pinned MNIST example and explain download, compilation, and execution stages.
4. ZML model lifecycle: explain tensors, shapes, loading, compilation, and execution.
5. Small ZML model walkthrough: provide complete runnable files and explain the relevant code.
6. LLMD installation: cover one selected, verified platform and its actual package requirements.
7. LLMD first request: load a named model, establish readiness, send a request, and show a successful response.
8. Compatibility reference: track product, version, OS/architecture, accelerator, model/precision, and verification status.

Execute the two core recipes on their declared configurations before marking them executed. Capture demonstrations of the ZML first run and the complete LLMD server/request cycle.

**Done when:** a new reader can reproduce a ZML result or obtain an LLMD response using the published prerequisites, commands, expected results, and troubleshooting.

## 5. Complete the operator and tool guides

Write four more pages, bringing the target to twelve:

9. Operate the selected LLMD deployment: host prerequisites, installation, model storage and credentials, startup/readiness, basic configuration, and upgrade/rollback procedure.
10. Monitoring and troubleshooting: service versus hardware metrics, common failures, and concrete diagnostic steps.
11. zml-smi introduction: hardware inspection and relevant output modes, with explicit product/platform limitations.
12. zml-lab benchmark/export walkthrough: application setup, connection to LLMD, benchmark execution, result interpretation, and export.

Capture a zml-smi terminal demonstration and a zml-lab screen demonstration. Validate the operator procedure on the selected deployment configuration and document limitations. Shared prerequisites and compatibility information should remain linked canonical content.

**Done when:** an operator can start the documented service, determine readiness, inspect its environment, diagnose a documented failure, and produce an interpretable benchmark export.

## 6. Add the command builder and publish the verified MVP

- Implement one small LLMD command builder using the verified recipe definitions and compatibility records. Offer only documented configurations and clearly state that it generates commands rather than executing inference.
- Provide copy, reset, and script download controls. Generated commands must agree with the corresponding guide and its required substitutions.
- Add explicit pull-request checks for the documentation build, links, anchors, assets, metadata, snippet references, and search output.
- Keep example compilation and hardware checks separate, triggered by relevant changes or deliberate revalidation. Record execution evidence without making hardware access a prerequisite for prose-only changes.
- Configure static hosting and deployment with pinned inputs; publish only validated output. Check navigation, search, playback, downloads, keyboard use, and mobile layout in the deployed site.

**Done when:** all twelve pages are reachable, four demonstrations work, the command builder matches the verified recipe, documentation checks pass, and execution claims have recorded evidence.

## MVP acceptance and deferred scope

The final authoring test is to add a fully explained recipe with commands, expected results, verification metadata, and a recording **without changing layout code or rebuilding the inference stack**.

Defer hosted inference, arbitrary browser Zig compilation, the recorded-results explorer, broad orchestration/platform coverage, a browser CMS, a framework migration, and parallel historical documentation. Full generated API integration can follow once its generation process is reliable.

## Source and verification boundary

This plan is derived from the supplied ZAST-to-ZML documentation proposal, whose research scope is dated **5 November 2026**. Its upstream findings are planning inputs, not new verification. Recheck release-specific requirements, compatibility claims, and tool status during implementation. Hardware execution and visual acceptance remain implementation work.
