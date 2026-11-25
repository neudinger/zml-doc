const std = @import("std");
const files = @import("files.zig");
const website = @import("website.zig");
const paths = @import("paths");

const Fixture = struct {
    temporary: std.testing.TmpDir,
    arena: std.heap.ArenaAllocator,
    directory: []const u8,

    fn init() !Fixture {
        var temporary = std.testing.tmpDir(.{});
        errdefer temporary.cleanup();
        var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
        errdefer arena.deinit();
        const directory = try temporary.dir.realPathFileAlloc(
            std.testing.io,
            ".",
            arena.allocator(),
        );
        return .{ .temporary = temporary, .arena = arena, .directory = directory };
    }

    fn deinit(self: *Fixture) void {
        self.temporary.cleanup();
        self.arena.deinit();
    }

    fn path(self: *Fixture, relative: []const u8) ![]const u8 {
        return std.fs.path.join(self.arena.allocator(), &.{ self.directory, relative });
    }

    fn put(self: *Fixture, relative: []const u8, contents: []const u8) !void {
        try files.write(std.testing.io, try self.path(relative), contents);
    }

    fn validate(self: *Fixture) !website.Result {
        return website.validate(self.arena.allocator(), std.testing.io, self.directory);
    }
};

test "validation resolves deployment prefixes, fragments, and encoded asset paths" {
    var fixture = try Fixture.init();
    defer fixture.deinit();
    try fixture.put("index.html",
        \\<body data-site-root="/docs/">
        \\<h1>Home</h1><a href="/docs/guide/?one=1&amp;two=2#result">Guide</a>
        \\<a href="https://example.com/external/">External</a>
        \\<img src="/docs/sample%20file.svg" alt="">
        \\</body>
    );
    try fixture.put("guide/index.html",
        \\<h1>Guide</h1><h2 id="result">Result</h2><a href="../">Home</a>
    );
    try fixture.put("sample file.svg", "<svg></svg>");
    const result = try fixture.validate();
    try std.testing.expectEqual(@as(usize, 2), result.pages);
    try std.testing.expectEqual(@as(usize, 3), result.references);
}

test "validation rejects broken references, duplicate IDs, and multiple H1 headings" {
    var fixture = try Fixture.init();
    defer fixture.deinit();
    const Case = struct { html: []const u8, failure: anyerror };
    const cases = [_]Case{
        .{
            .html = "<h1>Home</h1><a href=\"/missing/\">Bad</a>",
            .failure = error.MissingLocalReference,
        },
        .{
            .html = "<h1>Home</h1><a href=\"#absent\">Bad</a>",
            .failure = error.MissingFragment,
        },
        .{
            .html = "<h1>Home</h1><i id=\"same\"></i><b id=\"same\"></b>",
            .failure = error.DuplicateHtmlId,
        },
        .{
            .html = "<h1>Home</h1><h1>Another</h1>",
            .failure = error.InvalidHeadingCount,
        },
        .{
            .html = "<h1>Home</h1><img src=\"missing.svg\" alt=\"\">",
            .failure = error.MissingLocalReference,
        },
    };
    for (cases) |case| {
        try fixture.put("index.html", try std.fmt.allocPrint(
            fixture.arena.allocator(),
            "<body data-site-root=\"/\">{s}</body>",
            .{case.html},
        ));
        try std.testing.expectError(case.failure, fixture.validate());
    }
}

test "custom data attributes are not HTML identifiers or source references" {
    var fixture = try Fixture.init();
    defer fixture.deinit();
    try fixture.put("index.html",
        \\<body data-site-root="/">
        \\<h1 id="title" data-id="title">Home</h1>
        \\<span data-src="not-an-asset" data-href="not-a-link"></span>
        \\</body>
    );
    _ = try fixture.validate();
}

test "preflight rejects duplicate page routes and page asset collisions" {
    var fixture = try Fixture.init();
    defer fixture.deinit();
    const allocator = fixture.arena.allocator();
    try fixture.put("layouts/content.shtml", "layout");
    try fixture.put("assets/site.css", "style");
    try fixture.put("content/index.smd", "home");
    try fixture.put("content/guide.smd", "page");
    try fixture.put("content/guide/index.smd", "duplicate");
    try std.testing.expectError(
        error.DuplicatePageRoute,
        website.preflight(allocator, std.testing.io, fixture.directory),
    );
    try fixture.temporary.dir.deleteFile(std.testing.io, "content/guide.smd");
    try fixture.put("assets/guide/index.html", "collision");
    try std.testing.expectError(
        error.PageAssetCollision,
        website.preflight(allocator, std.testing.io, fixture.directory),
    );
}

test "URL normalization rejects invalid escapes and paths outside the site root" {
    var arena = std.heap.ArenaAllocator.init(std.testing.allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    try std.testing.expectError(error.InvalidUrl, website.decode(allocator, "%zz"));
    try std.testing.expectError(error.InvalidUrl, website.decode(allocator, "%00"));
    try std.testing.expectError(error.InvalidUrl, website.decode(allocator, "%5c"));
    try std.testing.expectError(error.PathEscapesRoot, website.localPath(allocator, "../x"));
    try std.testing.expectError(
        error.MissingLocalReference,
        website.sitePath(allocator, "/elsewhere/", "docs"),
    );
}

fn pairingTable(fixture: *Fixture, path: []const u8) ![]const u8 {
    const html = try files.read(fixture.arena.allocator(), std.testing.io, try fixture.path(path));
    const marker = std.mem.cut(u8, html, "data-llmd-pairings") orelse return error.MissingPairings;
    return (std.mem.cut(u8, marker[1], "</table>") orelse return error.MissingPairings)[0];
}

fn checkDrafterHandoffs(fixture: *Fixture) !void {
    const allocator = fixture.arena.allocator();
    const catalog = try pairingTable(fixture, "dist/llmd/user-guide/model-compatibility/index.html");
    const launch_route = "/llmd/user-guide/configure-launch/2026.11.3/";
    const workspace = try pairingTable(fixture, "dist" ++ launch_route ++ "index.html");
    var checkpoints: std.StringHashMapUnmanaged(void) = .empty;
    var pairs: std.StringHashMapUnmanaged(void) = .empty;
    var workspace_rows = std.mem.splitSequence(u8, workspace, "</tr>");
    while (workspace_rows.next()) |row| {
        var model = website.attributes(row, "data-checkpoint");
        const checkpoint = model.next() orelse continue;
        try std.testing.expect(!(try checkpoints.getOrPut(allocator, checkpoint)).found_existing);
        var drafters = website.attributes(row, "data-drafter");
        while (drafters.next()) |drafter| {
            const pair = try std.mem.join(allocator, " ", &.{ checkpoint, drafter });
            try std.testing.expect(!(try pairs.getOrPut(allocator, pair)).found_existing);
        }
    }
    try std.testing.expect(checkpoints.count() >= 18);
    try std.testing.expect(pairs.count() >= 53);

    const backends = [_][]const u8{ "cuda", "rocm", "metal", "oneapi", "tpu", "furiosa" };
    var rows = std.mem.splitSequence(u8, catalog, "</tr>");
    while (rows.next()) |row| {
        var model = website.attributes(row, "data-checkpoint");
        const checkpoint = model.next() orelse continue;
        try std.testing.expect(checkpoints.remove(checkpoint));
        var items = std.mem.splitSequence(u8, row, "data-drafter=\"");
        _ = items.next(); // Row label and target checkpoint link.
        while (items.next()) |item| {
            const drafter, const rest = std.mem.cutScalar(u8, item, '"') orelse return error.MissingDrafter;
            try std.testing.expect(pairs.remove(try std.mem.join(allocator, " ", &.{ checkpoint, drafter })));
            var linked: std.StringHashMapUnmanaged(void) = .empty;
            var hrefs = website.attributes(rest, "href");
            while (hrefs.next()) |href| {
                const path, const query = std.mem.cutScalar(u8, href, '?') orelse continue;
                try std.testing.expect(std.mem.endsWith(u8, path, launch_route));
                var params: std.StringHashMapUnmanaged([]const u8) = .empty;
                var fields = std.mem.splitScalar(u8, try std.mem.replaceOwned(u8, allocator, query, "&amp;", "&"), '&');
                while (fields.next()) |field| {
                    const key, const value = std.mem.cutScalar(u8, field, '=') orelse return error.InvalidUrl;
                    try params.putNoClobber(allocator, key, try website.decode(allocator, value));
                }
                try std.testing.expectEqualStrings(checkpoint, params.get("model") orelse return error.MissingModel);
                try std.testing.expectEqualStrings(drafter, params.get("drafter") orelse return error.MissingDrafter);
                try std.testing.expectEqualStrings("external", params.get("decoding") orelse return error.MissingDecodingMode);
                const backend = params.get("backend") orelse return error.MissingBackend;
                try std.testing.expect(!(try linked.getOrPut(allocator, backend)).found_existing);
            }
            try std.testing.expectEqual(backends.len, linked.count());
            for (backends) |backend| try std.testing.expect(linked.contains(backend));
        }
    }
    try std.testing.expectEqual(@as(usize, 0), pairs.count());
    try std.testing.expectEqual(@as(usize, 0), checkpoints.count());
}

fn checkLegacyRoutes(fixture: *Fixture) !void {
    const allocator = fixture.arena.allocator();
    const cases = [_]struct { source: []const u8, destination: []const u8 }{
        .{ .source = "llmd/", .destination = "/llmd/user-guide/" },
        .{
            .source = "llmd/developer-guide/",
            .destination = "/llmd/developer-guide/connect-an-application-to-llmd/#send-a-chat-message",
        },
        .{ .source = "llmd/quickstart/", .destination = "/llmd/user-guide/quickstart/" },
        .{
            .source = "llmd/user-guide/configure-launch/",
            .destination = "/llmd/user-guide/configure-launch/2026.11.3/",
        },
        .{
            .source = "llmd/launch/",
            .destination = "/llmd/user-guide/configure-launch/2026.11.3/#gemma-4-31b-it-cuda",
        },
        .{
            .source = "llmd/quickstart-apple-silicon/",
            .destination = "/llmd/user-guide/configure-launch/2026.11.3/#lfm3-fp8-metal",
        },
        .{
            .source = "operations/deployment/",
            .destination = "/llmd/user-guide/operations/deploy-llmd/",
        },
    };
    for (cases) |case| {
        const output = try std.fmt.allocPrint(allocator, "dist/{s}index.html", .{case.source});
        const page = try files.read(allocator, std.testing.io, try fixture.path(output));
        try std.testing.expect(std.mem.indexOf(u8, page, "data-pagefind-ignore") != null);
        var links = website.attributes(page, "href");
        const found = while (links.next()) |href| {
            if (std.mem.endsWith(u8, href, case.destination)) break true;
        } else false;
        if (!found) std.debug.print("Missing legacy destination for /{s}\n", .{case.source});
        try std.testing.expect(found);
    }
}

test "render and validation failures preserve the last site; success removes stale output" {
    var fixture = try Fixture.init();
    defer fixture.deinit();
    const allocator = fixture.arena.allocator();
    for ([_][]const u8{ "content", "layouts", "assets" }) |directory| {
        for (try files.list(allocator, std.testing.io, directory)) |relative| {
            const source = try std.fs.path.join(allocator, &.{ directory, relative });
            try fixture.put(source, try files.read(allocator, std.testing.io, source));
        }
    }
    try fixture.put("zine.ziggy", try files.read(allocator, std.testing.io, "zine.ziggy"));
    try fixture.put("dist/previous.txt", "Last valid build");
    const original = try files.read(allocator, std.testing.io, "content/index.smd");
    const options: website.Options = .{
        .zine_executable = try std.Io.Dir.cwd().realPathFileAlloc(
            std.testing.io,
            paths.zine_executable,
            allocator,
        ),
        .site_directory = fixture.directory,
        .output_directory = try fixture.path("dist"),
        .engine_stderr = .ignore,
    };
    try fixture.put("content/index.smd", try std.fmt.allocPrint(
        allocator,
        "{s}\n~~~=html\n<a href=\"/missing/\">Broken</a>\n~~~\n",
        .{original},
    ));
    try std.testing.expectError(
        error.MissingLocalReference,
        website.build(allocator, std.testing.io, options),
    );
    try fixture.put("content/index.smd", "---\ninvalid frontmatter\n---\n");
    try std.testing.expectError(
        error.ZineFailed,
        website.build(allocator, std.testing.io, options),
    );
    try std.testing.expectEqualStrings(
        "Last valid build",
        try files.read(allocator, std.testing.io, try fixture.path("dist/previous.txt")),
    );
    try fixture.put("content/index.smd", original);
    _ = try website.build(allocator, std.testing.io, options);
    try checkDrafterHandoffs(&fixture);
    try checkLegacyRoutes(&fixture);
    try std.testing.expect(try files.exists(
        std.testing.io,
        try fixture.path("dist/index.html"),
    ));
    try std.testing.expect(!try files.exists(
        std.testing.io,
        try fixture.path("dist/previous.txt"),
    ));
    const directory = try std.Io.Dir.cwd().openDir(
        std.testing.io,
        fixture.directory,
        .{ .iterate = true },
    );
    defer directory.close(std.testing.io);
    var entries = directory.iterate();
    while (try entries.next(std.testing.io)) |entry| {
        try std.testing.expect(!std.mem.startsWith(u8, entry.name, ".zine-build-"));
    }
}
