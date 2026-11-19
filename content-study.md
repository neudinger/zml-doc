# ZML and LLMD documentation content study

Use **Build with ZML** and **Serve models with LLMD** on the homepage and as the two documentation tabs. Each path leads to a reproducible first result. Keep deployment, monitoring, and troubleshooting under **Operations** in the LLMD tab. Share the compatibility and model-storage references across both products.

## Reference sites

| Source | Pattern to use for ZML and LLMD |
| --- | --- |
| [Liquid AI LLMD deployment guide](https://docs.liquid.ai/deployment/gpu-inference/zml-llmd) | One serving flow with platform-specific prerequisites and startup commands, followed by a common model-list and chat request. Put the local-checkpoint recipe below the first run. |
| [Liquid AI model library](https://docs.liquid.ai/lfm/models/complete-library) | A browsable model index with exact checkpoints and formats. Add release, backend, precision, and evidence to each ZML or LLMD compatibility row. |
| [Furiosa developer docs](https://developer.furiosa.ai/latest/en/index.html) | Give prerequisites, quickstart, model support, serving API, containers, monitoring, and release notes stable homes. Use the path from installation to operation to order the LLMD sidebar. |
| [ZML website](https://zml.ai/), [LLMD product page](https://zml.ai/llmd/), and [ZML repository](https://github.com/zml/zml) | The homepage explains the framework and server, then links to an actual result for each. The product page defines published install channels. The public repository supplies the framework examples and model lifecycle guides. |

## Proposed pages under `content/`

| Order | File | Draft content |
| --- | --- | --- |
| 1 | `index.smd` and `start/index.smd` | Revise the existing drafts around the two product paths. Explain who needs Bazel, who needs a runtime, and how to check a configuration. |
| 2 | `zml/quickstart.smd` | Install Bazelisk, check out a pinned ZML commit, build and run MNIST on CPU, identify the prediction, run a targeted test, and diagnose download failures. |
| 3 | `llmd/quickstart.smd` | Start a pinned CUDA container on a Linux host, check readiness, list the model, and send a chat request. Add other startup variants after execution checks. Link to an existing endpoint workflow. |
| 4 | `reference/compatibility.smd` | List framework build targets and server install channels. Add tested model/checkpoint rows with the platform requirements and links to working recipes. |
| 5 | `zml/first-model.smd` | Explain tagged tensors and shapes through a minimal model. Show weight loading, compilation to an executable, buffer ownership, execution, and output. Update `zml/index.smd` to lead into this and the quickstart. |
| 6 | `zml/build-and-run.smd` | Show Bazel target selection, accelerator flags, LLM one-shot and interactive runs, model paths, tests, and the cross-build/archive workflow. |
| 7 | `llmd/models.smd` | Explain checkpoint structure, public and gated Hugging Face repositories, and local directory mounts. Add S3 and GCS recipes with the shared credentials reference. Update `llmd/index.smd` to link to quickstart, models, and Operations. |
| 8 | `llmd/api.smd` | Document `GET /v1/models` and `POST /v1/chat/completions` first. Expand with streaming, sampling, tool calling, and supported schema fields as verified per release and model. |
| 9 | `llmd/cli.smd` | List startup flags by networking, memory and batching, sampling, parallelism, and speculative decoding. Include defaults, value types, and release scope. |
| 10 | `reference/environment.smd` | Document model-storage credentials, runtime and diagnostics variables, CLI forwarding into containers, and telemetry opt-outs. |
| 11 | `operations/deployment.smd` | Cover Docker backend tags, hardware access, network exposure, local weights, readiness, and upgrade and rollback. Update `operations/index.smd` to lead into these tasks. |
| 12 | `operations/monitoring.smd` | Add Prometheus, logs, device checks, and a troubleshooting flow for checkpoint access, startup, unavailable devices, and out-of-memory failures. Link zml-smi and profiling from here. |

Write pages 2–4 first. The homepage can promise **classify an image with ZML** and **serve a checkpoint and receive a chat response with LLMD**. The documentation entry should link to these quickstarts plus Compatibility. The CUDA article supplies prerequisites, copyable commands, expected results, and troubleshooting.

Use separate compatibility rows for ZML examples and LLMD. List model families for discovery and exact checkpoints for recipes. Each tested row needs the product revision or image digest, OS and architecture, accelerator and driver, checkpoint and revision, precision, capability, run date, and evidence. Seed the catalogue with these source-reviewed candidates.

| Product | Candidate | Platform and precision | Evidence |
| --- | --- | --- | --- |
| ZML | `//examples/mnist` at the ZML source pin | CPU. Record the selected host and the bundled checkpoint. | [Public smoke test](https://github.com/zml/zml#30-second-smoke-test) |
| ZML | `meta-llama/Llama-3.2-1B-Instruct` | Framework example. Record precision and backend after execution. | [Public LLM quickstart](https://github.com/zml/zml#llm-quickstart) |
| LLMD | `LiquidAI/LFM3-1.7B-FP8` | CUDA, ROCm, and Apple Metal recipes published for the 20261029.0 release. | [LLMD release](https://zml.ai/posts/llmd-20261029.0/) |
| LLMD | `LiquidAI/LFM3-1.7B` | BF16 for oneAPI and TPU in the 20261029.0 release. | [LLMD release](https://zml.ai/posts/llmd-20261029.0/) |

This study lives outside the Zine content directory for review. The proposed filenames target its existing SuperMD sections.

## ZML build and run inventory

The [public quickstart](https://github.com/zml/zml#getting-started) recommends Bazelisk. Let the checked-out `.bazelversion` select Bazel. The monorepo's cached ZML dependency at the pin recorded below uses Bazel `9.3.0` and declares the Zig `0.17.0` toolchain in `MODULE.bazel`.

```sh
# From the root of the selected ZML checkout.
bazel build //examples/mnist
bazel run //examples/mnist
bazel test //zml:test
```

The MNIST example loads a small pretrained checkpoint and classifies a handwritten digit. Use the prediction and the input digit as the verification result. Record the output from the selected checkout when executing the recipe.

```sh
# Gated Hugging Face repositories require access and a token.
bazel run //tools/hf -- auth login
bazel run //examples/llm -- \
  --model=hf://meta-llama/Llama-3.2-1B-Instruct --prompt='What is the capital of France?'
```

Remove `--prompt` for interactive generation. For accelerator runs, put compilation switches **before** Bazel's `--` separator and example options after it. A pinned example can recognize model types that differ from LLMD's supported checkpoints. [LLM example](https://github.com/zml/zml/tree/master/examples/llm)

| Layer | Options and scope |
| --- | --- |
| Bazel commands | `bazel build` compiles, `bazel run` builds and starts the named target on a suitable host, and `bazel test` executes the selected test target. |
| Backend inclusion | `--@zml//platforms:<backend>=true` includes the named runtime when the target platform matches. `cpu` defaults to `true`. `cuda`, `rocm`, `tpu`, `neuron`, `oneapi`, `metal`, and `furiosa` default to `false`. Use `--@zml//platforms:cpu=false` when the intended configuration excludes CPU. |
| Target platform | `--platforms=@zml//platforms:linux_amd64`, `linux_arm64`, `macos_amd64`, or `macos_arm64` with the same label prefix. The pinned backend rules constrain ROCm, TPU, Neuron, oneAPI, and Furiosa to Linux x86-64 and Metal to macOS ARM64. Device, driver, and plugin support also depend on the selected artifact. |
| Runtime platform selection | The pinned examples call `Platform.auto()`. Its priority is TPU, Neuron, ROCm, CUDA, oneAPI, Metal, Furiosa, then CPU among backends that initialize. Record the platform printed by the example. |
| Build profiles | `--config=debug`, `--config=alldebug`, `--config=release`, and `--config=native` are named in the pinned `.bazelrc`. Document `native` for host-specific builds alongside the cross-build caveat. `silent` controls Bazel output. |
| Profiling | `bazel run` configs `nsys`, `rocprofv3`, and `neuron-profile` wrap backend-specific tools. Publish versioned recipes with profiler prerequisites and output paths. |
| Packaging | Cross-build `//examples/mnist:archive` or `//examples/llm:archive` for the destination and carry the packaged runfiles. The example packages also define OCI targets. [ZML deployment guide](https://github.com/zml/zml/blob/master/docs/howtos/deploy_on_server.md) |

Example CUDA build from the public ZML checkout, to verify on the selected Linux toolchain and device:

```sh
bazel build --config=release //examples/llm:archive \
  --platforms=@zml//platforms:linux_amd64 --@zml//platforms:cuda=true
```

| `//examples/llm` option | Default | Description |
| --- | --- | --- |
| `--model=<path>` | Required | Checkpoint directory. The pin registers `file`, `hf`, `s3`, and `gs` storage schemes. |
| `--prompt=<text>` | Unset | One-shot generation when supplied, interactive mode otherwise. |
| `--seqlen=<tokens>` | `2048` | Sequence length used for compilation and generation. |
| `--topk=<number>` | `4` | Top-k sampling cutoff. |
| `--backend=<stablehlo\|cute\|nki\|metal>` | Auto | Selects the attention implementation. CuTe depends on compatible CUDA hardware. |
| `--profile` | Off | Captures a PJRT trace for one-shot generation. |
| `-h`, `--help` | Off | Displays the example's help. |

Examples to add after MNIST and LLM are `//examples/sharding` for mesh and partitioning, `//examples/io:playground` for VFS operations, and `//examples/benchmark` for model-loading and execution measurements. Give each command its own argument table. The framework API also exposes compiler and platform options through Zig. Cover those with API examples, such as choosing an allocator, setting CPU logical devices, and defining a sharding mesh. [ZML documentation](https://github.com/zml/zml/tree/master/docs)

## LLMD install and serve inventory

| Platform | Installation | Host options in the published recipe |
| --- | --- | --- |
| NVIDIA CUDA | `zmlai/llmd:cuda`, Linux amd64 or arm64 | `--gpus=all --shm-size=256GB`. Requires appropriate host drivers and container GPU integration. `256GB` is the documented example size. |
| AMD ROCm | `zmlai/llmd:rocm`, Linux amd64 | `--device=/dev/kfd --device=/dev/dri`. Check host driver and device permissions. |
| Intel oneAPI | `zmlai/llmd:oneapi`, Linux amd64 | `--device=/dev/dri`. Check supported device and driver. |
| Google TPU | `zmlai/llmd:tpu`, Linux amd64 | `--net=host --privileged` on the TPU host in the published recipe. Explain host networking and required access in the TPU article. |
| Apple Metal | `brew install zml/zml/llmd`, macOS ARM64 | Run `llmd` natively. A local-development guide can use `--listen=127.0.0.1:8000` after checking the chosen build. |
| Furiosa | `zmlai/llmd:furiosa`, Linux amd64 | Registry and source evidence. Confirm a supported host, release, device mapping, and checkpoint before adding a quickstart. |

Sources for install channels and architecture are the [LLMD product page](https://zml.ai/llmd/), [LLMD registry](https://hub.docker.com/r/zmlai/llmd/tags), and [Homebrew tap](https://github.com/zml/homebrew-zml). Use the registry for artifact availability and the release notes for model and feature changes. Furiosa's [container setup](https://developer.furiosa.ai/latest/en/cloud_native_toolkit/container.html) is a starting point for a separate LLMD host validation.

### CUDA quickstart draft

The commands below use the CUDA backend tag with the smaller FP8 checkpoint in Liquid AI's CUDA recipe. They are source-reviewed, with execution pending on a CUDA host. Record the LLMD version, checkpoint revision, and successful response before publishing the tested recipe. [Liquid AI guide](https://docs.liquid.ai/deployment/gpu-inference/zml-llmd) · [Registry tags](https://hub.docker.com/r/zmlai/llmd/tags)

Prerequisites are a Linux host with a compatible NVIDIA GPU, its driver, Docker, NVIDIA Container Toolkit, and access to the public checkpoint. For gated models, obtain repository access and forward `HF_TOKEN` into the container.

```sh
docker pull zmlai/llmd:cuda
docker run --rm --name llmd \
  -p 127.0.0.1:8000:8000 --gpus=all --shm-size=256GB \
  zmlai/llmd:cuda --model=hf://LiquidAI/LFM3-1.7B-FP8
```

Run the request in a second terminal once the server accepts connections. Use the returned model identifier in the JSON body. The example assumes the server reports the default name derived from the checkpoint path.

```sh
curl -fsS http://127.0.0.1:8000/v1/models
curl -fsS http://127.0.0.1:8000/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"LFM3-1.7B-FP8","messages":[{"role":"user","content":"Reply with one short greeting."}]}'
```

Success is an HTTP response with an assistant message in `choices`. The output text can vary. Stop the foreground server with Ctrl+C. An application with an existing LLMD endpoint starts at the request step and uses that endpoint's authentication and model identifier.

Check the container logs when the endpoint fails to respond. Separate missing devices, denied checkpoint access, and memory failures from the time needed to load weights and compile. Use the Operations guide for replica health, restarts, Prometheus, and the previous known-working image and checkpoint.

Docker consumes flags **before** the image. The LLMD image entrypoint receives options **after** the image. Explain `-p`, `--gpus`, `--device`, `--shm-size`, `-e HF_TOKEN` for gated checkpoints, `--mount`, `--name`, `--rm`, and `-d`/`docker logs` for detached operation. To serve local weights, mount a complete checkpoint directory read-only at `/model` with `--mount type=bind,source=/absolute/host/checkpoint,target=/model,readonly` and pass `--model=/model`. Include `config.json`, `tokenizer.json`, safetensors weights, and model-specific files such as the chat template when required. The same model guide can show `--model=s3://bucket/checkpoint` and `--model=gs://bucket/checkpoint` with the corresponding credentials. Direct HTTPS is registered by the inspected LLMD source and needs a release-specific recipe. [Docker run reference](https://docs.docker.com/reference/cli/docker/container/run/) · [Liquid AI local weights recipe](https://docs.liquid.ai/deployment/gpu-inference/zml-llmd#use-local-model-weights)

Keep the container listener reachable through Docker's network mapping and bind the local published host port to loopback. The inspected LLMD HTTP setup has no built-in authentication layer in front of its routes. For external deployment, document the authenticated TLS proxy and scope the exposure of metrics and profiler endpoints to operators.

For contributors with the monorepo, `bazel build //llmd:llmd` compiles the binary, `bazel run //llmd:llmd -- --help` displays usage, and `bazel test //llmd:test` targets tests. For GPU development builds, add the backend build flag before `--`. `bazel build //llmd/distribution:cuda` builds the OCI index. `//llmd/distribution:{rocm,tpu,oneapi,furiosa}` are backend image targets and `//llmd/release:production_archive_macos_arm64` builds the Metal archive. Contributor profiles include `debug`, `alldebug`, `release`, `release_with_symbols`, and `native`. The monorepo `.bazelrc` and contributor guide describe the remote execution, incremental build, and dependency override configs. [Contributor guide](../monorepo/AGENTS.md) · [Release artifact notes](../monorepo/llmd/docs/CRASH_REPORTING.md)

### LLMD serving flags in the local source

These are the options shown in the local `CliArgs.help`. Confirm that the published binary exposes the same options before copying the table into a versioned reference. Use `--name=value` for value-taking flags, bare switches for booleans, and `-h` or `--help` to list public usage.

| Option | Default or fallback | Meaning |
| --- | --- | --- |
| `--model=<path>` | Required | Local directory or supported checkpoint URI. |
| `--model-name=<text>` | Basename of model path | Identifier returned by the API. |
| `--listen=<address>` | `0.0.0.0:8000` | HTTP bind address. An address without a port uses `8000`. |
| `--batch-size=<number>` | `16` | Maximum number of concurrent requests in a batch. |
| `--token-batch-size=<tokens>` | `1024` | Token limit for one inference step. |
| `--max-context-len=<tokens>` | `128000` | Server context limit. Actual support depends on the model and available memory. |
| `--prefill-chunk-size=<tokens>` | `256` | Per-sequence token limit during chunked prefill. |
| `--page-chunk-size=<tokens>` | `16` | Tokens per KV-cache page. |
| `--gpu-memory-fraction=<fraction>` | `0.9` | Device memory allocation fraction, in `(0, 1]`. Applied by backend-specific allocators in the source. |
| `--cache-memory-fraction=<fraction>` | `0.95` | In `(0, 1]`. Scales the smallest reported per-device memory limit, then the cache planner subtracts fixed allocations to budget pages. |
| `--data-parallel=<number>` | `1` | Number of groups for request and KV-cache sharding in supported configurations. Introduced for Llama in beta. [20261106.0 notes](https://zml.ai/posts/llmd-20261106.0/#data-parallelism-beta) |
| `--top-k=<number>` | Fallback `50` | Top-k sampling cutoff. |
| `--top-p=<fraction>` | Fallback `1.0` | Nucleus threshold, in `[0, 1]`. |
| `--min-p=<fraction>` | Fallback `0.0` | Minimum probability threshold, in `[0, 1]`. |
| `--temperature=<number>` | Fallback `1.0` | Sampling temperature. |
| `--speculative-drafter-model=<path>` | Unset | Enable speculative decoding with a compatible drafter checkpoint or `native` where implemented. |
| `--speculative-draft-count=<tokens>` | From model configuration | Override draft token count. Requires a compatible speculative setup. |
| `--systemone-window=<number>` | `max(1, batch_size / 4)` | Concurrent questions in one SystemOne request. Advanced API surface. |

Sampling flags are optional overrides. In the inspected service, chat request `temperature` and `top_p` take precedence, followed by CLI values, model sampling defaults, and fallback values. `top_k` and `min_p` start at the CLI level. [20261112.0 sampling controls](https://zml.ai/posts/llmd-20261112.0/#sampling-controls)

`GET /health` returns `OK` in the local build. A model completion verifies inference. `GET /metrics` exports Prometheus data. The source also registers legacy `POST /v1/completions`, `POST /v1/systemone`, `POST /profiler-start`, and `POST /profiler-stop`. Record release availability before adding them to the API reference.

### LLMD source options outside the CLI help

Keep these in the local inventory. The consuming code and target release determine which deserve contributor or advanced documentation.

| Flags | Defaults and context |
| --- | --- |
| `--attnd-workers`, `--attnd-memory` | Both unset. Together opt into the attention daemon backend with worker count and memory in GiB. |
| `--io-impl` | `zio`; alternative `threaded`. Developer diagnostics. |
| `--async-scheduling` | Off. The 20261106.0 beta applies to Llama and Gemma 4 without speculative decoding. [Release notes](https://zml.ai/posts/llmd-20261106.0/#asynchronous-scheduling-beta) |

## Environment variables and backend diagnostics

Run program variables in the program's environment. For Docker, pass selected variables explicitly with `-e NAME` and use container paths for mounted files and directories. Record where each variable takes effect.

| Scope | Variables and precedence in the inspected source |
| --- | --- |
| Hugging Face | `HF_TOKEN`, then `$HOME/.cache/huggingface/token`, then anonymous access. Use `bazel run //tools/hf -- auth login` in the public ZML checkout or pass the token through the runtime environment. The pinned VFS accepts `hf://org/repo[@revision][/subdir]` and defaults to `main`. |
| S3 | `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` together enable signing. `AWS_ENDPOINT_URL` takes precedence over `AWS_ENDPOINT_URL_S3`, then `https://s3.amazonaws.com`. `AWS_REGION` precedes `AWS_DEFAULT_REGION`, then `us-east-1`. The inspected auto loader uses anonymous access without both keys. |
| GCS | `GOOGLE_APPLICATION_CREDENTIALS` selects a credential file. When unset, the loader checks the local gcloud ADC file. If credentials are unavailable, it can try the GCP metadata server and then anonymous access. |
| HTTP proxy | LLMD initializes the standard library's default proxies. Confirm exact proxy variable precedence and tested storage backends on the pinned toolchain before listing a proxy recipe. |
| Crash and usage reporting | `DO_NOT_TRACK=1` disables both in the local LLMD build. `LLMD_NO_USAGE_STATS=1` disables usage only. Maintainer configuration names are `SENTRY_DSN`, `LLMD_SENTRY_HANDLER_PATH`, `LLMD_USAGE_STATS_ENDPOINT`, and `LLMD_POSTHOG_TOKEN`. Document release-specific defaults and user controls together. |
| Autotune cache | `ZML_AUTOTUNE_CACHE_DIR` selects a per-fusion cache directory for CUDA, ROCm, and oneAPI in the pinned ZML compiler. |
| Logs and profiling | `TF_CPP_MIN_LOG_LEVEL` defaults to `3` in the ZML platform setup. `SKIP_PJRT_PROFILER=true` skips PJRT profiling. `LLMD_PROFILE_DEVICE_ONLY=1` selects device-only profiling in the local LLMD source. |
| Terminal output | `NO_COLOR`, `CLICOLOR_FORCE`, `COLORTERM`, and `TERM` influence the ZML and LLMD logos. Bazel supplies `BUILD_WORKING_DIRECTORY` to ZML's LLM example to resolve paths from the caller's directory. |
| Backend troubleshooting | The pinned source reads `LD_LIBRARY_PATH` during CUDA diagnostics, `ROCPROFILER_LOG_LEVEL` for ROCm profiling, `CCL_LOG_LEVEL` for oneAPI, `NEURON_CC_FLAGS` and `NEURON_RT_LOG_LEVEL` for Neuron, and `FURIOSA_VISIBLE_DEVICES` for Furiosa. Keep the scope and defaults in individual backend recipes, with the corresponding driver or plugin version. |
| Compiler diagnostics | `XLA_FLAGS` is passed through the runtime environment. For a release with confirmed HLO dump support, `--xla_dump_to=/path --xla_dump_hlo_as_text` is a starting point. [OpenXLA HLO dumps](https://openxla.org/xla/hlo_dumps) |

Treat `xla-private` as source evidence for PJRT plugin behavior and backend debugging. Its build targets are for plugin maintainers. Keep XLA flag details tied to the plugin shipped by the selected release. Public quickstarts consume the ZML dependencies or the LLMD artifact. The local CUDA, ROCm, CPU, and Metal plugin-build matrix describes compilation targets. Use product release evidence and hardware tests for the LLMD compatibility matrix. [OpenXLA flags guidance](https://openxla.org/xla/flags_guidance)

## Evidence and verification

- Public study sources were checked on 16 November 2026. The Liquid deployment page was read in the browser. Product claims and source declarations establish documentation candidates. Executed recipes require a recorded environment and result.
- The [monorepo ZML pin](../monorepo/MODULE.bazel#L52) is `8fcff8c462070d06056f8a85ba0c8a81f0f3a636`. Review its cached [`platforms/BUILD.bazel`](../monorepo/bazel-monorepo/external/zml+/platforms/BUILD.bazel#L5), [`examples/llm/main.zig`](../monorepo/bazel-monorepo/external/zml+/examples/llm/main.zig#L16), [`vfs`](../monorepo/bazel-monorepo/external/zml+/vfs), [`.bazelrc`](../monorepo/bazel-monorepo/external/zml+/.bazelrc), and [`zml/platform.zig`](../monorepo/bazel-monorepo/external/zml+/zml/platform.zig#L406) for defaults and option behavior. Use the public repo for published ZML guides.
- The local monorepo revision is `ca5751675501dc2ce4491dd70bc11f0cd3f3ebbb`. LLMD evidence includes [`CliArgs`](../monorepo/llmd/main.zig#L71), [HTTP route registration](../monorepo/llmd/main.zig#L545), [sampling resolution](../monorepo/llmd/openai_service.zig#L328), [model type registry](../monorepo/llmd/models.zig#L45), and [distribution rules](../monorepo/llmd/distribution/BUILD.bazel#L280). Source-visible model types and hidden flags belong in a versioned inventory with release evidence.
- The local XLA checkout is `47d6ca4ad9353a5819e8b5bcc0c757eb487c17af`. See its [plugin build notes](../xla-private/ZML_README.md), [debug flags](../xla-private/xla/debug_options_flags.cc), and [PJRT GPU option handling](../xla-private/xla/pjrt/c/pjrt_c_api_gpu_internal.cc#L115). Keep private CI setup and release administration in their owning repositories.
- Before publishing the first two recipes, run MNIST on one declared host and execute the CUDA server-to-chat flow. Record the source revision, image digest, model revision, accelerator, driver, version, actual output, and test date. Use `bazel query //examples/...`, the pinned example's `--help`, and the shipped LLMD `--help` to check targets and argument tables. Use `bazel help build` and `docker run --help` for the tool-wide options. Expand platform rows using the same checks. Build, pull, and inference tests remain pending.
