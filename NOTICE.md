# Source attribution

`tools/files.zig` and `tools/website.zig` are adapted from
[neudinger/zast-site](https://github.com/neudinger/zast-site), used under the
European Union Public Licence 1.2. The original licence is preserved in
`LICENSE`.

The adaptations remove ZAST-specific API and Wasm requirements, derive the site
root from the homepage link, and validate every authored page consistently.
The base SuperHTML shell follows the same Zine template structure; the content
and styling are specific to this documentation site.

The circular ZML mark is from the [ZML website](https://zml.ai/).
The outline icons are from [Tabler Icons 3.40.0](https://github.com/tabler/tabler-icons/tree/v3.40.0)
under the [MIT License](assets/icons/LICENSE.txt).
The [Inter typeface](https://rsms.me/inter/) is distributed under the
[SIL Open Font License](assets/fonts/OFL.txt).

The [Prism 1.30.0](https://github.com/PrismJS/prism/releases/tag/v1.30.0) syntax
highlighter is distributed under the [MIT License](assets/prism/LICENSE.txt).
The local bundle combines the upstream minified core and the Bash, JSON,
PromQL, Python, YAML, and Zig grammars.
