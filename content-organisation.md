# ZML documentation organisation and visual proposal

## Scope

Organize the MVP content and establish its visual hierarchy before implementing
step 2. Readers enter through **Run models**, **Build with ZML**, or **Operate
deployments**, then follow shared canonical guides. Keep the existing Zine
foundation and develop a light documentation interface with a restrained green
accent.

This is a proposed structure. The twelve guides below are the substantial MVP
content target; the homepage and short section indexes are additional navigation
surfaces. The current overview pages remain starting material for those indexes.

## Navigation model

The homepage presents the three reader journeys. The documentation sidebar
organizes content by subject: **Start**, **ZML**, **LLMD**, **Operations**,
**Tools**, and **Reference**. **Recipes** is a task index linking to canonical
guides across those sections, rather than a second home for the same procedures.

The global header contains the documentation identity, a search entry, and the
upstream source link. Keep product and chapter navigation in the sidebar so
readers can see the hierarchy in one place. Search is a planned control in the
visual concepts; implementing it remains part of step 2.

On narrow screens, collapse the sidebar behind a labelled navigation control.
Keep the current section and page title visible. Only expose published pages in
the implemented navigation.

## Canonical MVP pages

| Section | Page | Canonical URL | Page type |
| --- | --- | --- | --- |
| Start | Choose your path and understand the ecosystem | `/start/` | Explanation |
| Start | Choose a configuration | `/start/configuration/` | How-to |
| ZML | Run the first example | `/zml/first-run/` | Tutorial |
| ZML | Understand the model lifecycle | `/zml/model-lifecycle/` | Explanation |
| ZML | Write a small model | `/zml/first-model/` | Tutorial |
| LLMD | Install LLMD | `/llmd/installation/` | How-to |
| LLMD | Start a server and send a request | `/llmd/first-request/` | Tutorial |
| Operations | Deploy and manage LLMD | `/operations/deployment/` | How-to |
| Operations | Monitor and troubleshoot | `/operations/monitoring/` | How-to |
| Tools | Inspect hardware with zml-smi | `/tools/zml-smi/` | How-to |
| Tools | Benchmark and export with zml-lab | `/tools/zml-lab/` | How-to |
| Reference | Compatibility and verification records | `/reference/compatibility/` | Reference |

The existing `/zml/`, `/llmd/`, and `/operations/` routes serve as section
indexes. Add `/tools/`, `/recipes/`, and `/reference/` indexes as their content
becomes available. Product names identify sections; task-oriented titles identify
individual guides.

## Reader journeys

| Entry path | Default sequence | Alternate entry |
| --- | --- | --- |
| Run models | Choose configuration → install LLMD → start server and send request | Existing endpoint users enter at the client-request section; framework-example users follow ZML first run |
| Build with ZML | ZML first run → model lifecycle → first model | Experienced developers enter at the lifecycle explanation |
| Operate deployments | Choose configuration → deployment → monitoring and troubleshooting | Existing-service operators enter at monitoring; benchmarking links to zml-lab |

Configuration selection links to the shared compatibility reference. Monitoring
links to zml-smi. Benchmarking links to zml-lab. Requirements, model access, and
verification facts have one maintained home and are linked from each journey.

## Homepage hierarchy

1. A compact introduction explains the difference between the framework and the
   inference server.
2. A prominent **Choose your path** action leads into the ecosystem guide.
3. Three concise journey entries explain the intended result and show the next
   canonical guide.
4. A small supporting section links to configuration selection and compatibility.

Use task names and expected outcomes rather than a catalogue of features. Avoid
performance statistics, support badges, or platform claims without verified
records. Search and future controls in mockups represent proposed behavior.

## Documentation page hierarchy

Use a shared shell: global header, subject sidebar, readable article, and a
compact **On this page** rail when the article is long enough to need one.

The article begins with its section breadcrumb, page type, title, and a sentence
describing the outcome. A procedure then presents prerequisites, numbered steps,
copyable commands, expected results, troubleshooting, and a next guide.
Verification details belong beside executable instructions and demonstrations.

Terminal recordings supplement the written procedure. Treat commands and expected
output as separate blocks. For the graphical zml-lab workbench, reserve a suitable
area for screenshots or screen video.

## Visual constraints

Keep the current off-white background, dark green text, muted secondary text,
and restrained green accent as the starting palette. Use clear sans-serif
typography and a monospace face for code. Constrain article text to approximately
65 characters per line and keep body copy comfortably readable.

Use whitespace and alignment first, then light dividers. Reserve bordered
surfaces for code, recordings, and distinct interactive tools. Make active
navigation, keyboard focus, and links identifiable without relying on color
alone. Keep the homepage and article shell visually related.

## Review criteria before step 2

- A reader can distinguish running a server, using an endpoint, and building a model.
- Each planned guide has one canonical location and a clear role in a journey.
- The chosen visual direction makes the hierarchy legible without presenting every page at once.
- The design accommodates a long article, code, expected output, and a recording.
- Narrow-screen navigation and long-form reading remain practical.

Implementation of the new navigation, search, components, and responsive behavior
starts after a visual direction has been selected. This proposal does not mark
step 2 complete.
