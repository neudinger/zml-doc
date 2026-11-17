//! Render, index, and validate the output before replacing the last valid site.
//! Paths are borrowed; command arguments and validation storage use a caller arena.
const std = @import("std");
const files = @import("files.zig");

pub const Options = struct {
    zine_executable: []const u8,
    site_directory: []const u8 = ".",
    output_directory: []const u8 = "dist",
    engine_stderr: std.process.SpawnOptions.StdIo = .inherit,
};
pub const Result = struct { pages: usize = 0, references: usize = 0 };

pub const Attributes = struct {
    source: []const u8,
    needle: []const u8,
    offset: usize = 0,

    pub fn next(self: *Attributes) ?[]const u8 {
        while (std.mem.indexOfPos(u8, self.source, self.offset, self.needle)) |start| {
            self.offset = start + self.needle.len;
            if (start != 0 and !std.ascii.isWhitespace(self.source[start - 1])) continue;
            const end = std.mem.indexOfScalarPos(u8, self.source, self.offset, '"') orelse
                return null;
            const value = self.source[self.offset..end];
            self.offset = end + 1;
            return value;
        }
        return null;
    }
};

pub fn attributes(source: []const u8, comptime name: []const u8) Attributes {
    return .{ .source = source, .needle = name ++ "=\"" };
}

/// Decode strict percent escapes before resolving paths; reject embedded separators
/// interpreted differently by URI and filesystem implementations.
pub fn decode(allocator: std.mem.Allocator, encoded: []const u8) ![]const u8 {
    var position: usize = 0;
    while (position < encoded.len) : (position += 1) if (encoded[position] == '%') {
        if (encoded.len - position < 3) return error.InvalidUrl;
        _ = std.fmt.parseInt(u8, encoded[position + 1 ..][0..2], 16) catch return error.InvalidUrl;
        position += 2;
    };
    const decoded = std.Uri.percentDecodeInPlace(try allocator.dupe(u8, encoded));
    if (std.mem.indexOfAny(u8, decoded, "\x00\\") != null or
        !std.unicode.utf8ValidateSlice(decoded)) return error.InvalidUrl;
    return decoded;
}

/// Return a normalized relative path, rejecting attempts to ascend above its root.
pub fn localPath(allocator: std.mem.Allocator, path: []const u8) ![]const u8 {
    var parts: std.ArrayList([]const u8) = .empty;
    var segments = std.mem.tokenizeScalar(u8, path, '/');
    while (segments.next()) |segment| {
        if (std.mem.eql(u8, segment, ".")) continue;
        if (std.mem.eql(u8, segment, "..")) {
            _ = parts.pop() orelse return error.PathEscapesRoot;
        } else try parts.append(allocator, segment);
    }
    return std.mem.join(allocator, "/", parts.items);
}

/// Normalize a URL path and remove its exact deployment prefix before disk lookup.
/// prefix is a normalized relative path; URLs outside it fail validation.
pub fn sitePath(allocator: std.mem.Allocator, path: []const u8, prefix: []const u8) ![]const u8 {
    const normalized = try localPath(allocator, try decode(allocator, path));
    if (prefix.len == 0) return normalized;
    if (std.mem.eql(u8, normalized, prefix)) return "";
    if (!std.mem.startsWith(u8, normalized, prefix) or normalized[prefix.len] != '/')
        return error.MissingLocalReference;
    return normalized[prefix.len + 1 ..];
}

/// Validate Zine-generated HTML, local href/src paths, and fragments.
pub fn validate(allocator: std.mem.Allocator, io: std.Io, directory: []const u8) !Result {
    const Page = struct {
        html: []const u8,
        identifiers: std.StringHashMapUnmanaged(void) = .empty,
    };
    var pages: std.StringArrayHashMapUnmanaged(Page) = .empty;
    for (try files.list(allocator, io, directory)) |relative| {
        if (!std.mem.endsWith(u8, relative, ".html")) continue;
        const page_path = try std.fs.path.join(allocator, &.{ directory, relative });
        var page: Page = .{ .html = try files.read(allocator, io, page_path) };
        var identifiers = attributes(page.html, "id");
        while (identifiers.next()) |identifier| {
            const entry = try page.identifiers.getOrPut(allocator, identifier);
            if (entry.found_existing) return error.DuplicateHtmlId;
        }
        var offset: usize = 0;
        var headings: usize = 0;
        while (std.mem.indexOfPos(u8, page.html, offset, "<h1")) |start| {
            offset = start + 3;
            if (offset < page.html.len and
                (page.html[offset] == '>' or std.ascii.isWhitespace(page.html[offset])))
                headings += 1;
        }
        if (headings != 1) return error.InvalidHeadingCount;
        try pages.put(allocator, relative, page);
    }
    // The template uses Zine's index link, including any deployment prefix.
    const homepage = pages.get("index.html") orelse return error.MissingHomePage;
    var roots = attributes(homepage.html, "data-site-root");
    const site_root = roots.next() orelse return error.InvalidSiteRoot;
    if (!std.mem.startsWith(u8, site_root, "/") or
        std.mem.startsWith(u8, site_root, "//") or
        !std.mem.endsWith(u8, site_root, "/")) return error.InvalidSiteRoot;
    const prefix = try localPath(allocator, try decode(allocator, site_root));
    var result: Result = .{ .pages = pages.count() };
    for (pages.keys(), pages.values()) |relative, page| {
        const base = try std.Uri.parse(try std.fmt.allocPrint(
            allocator,
            "https://site.invalid{s}{s}",
            .{ site_root, relative },
        ));
        inline for (.{ "href", "src" }) |attribute| {
            var references = attributes(page.html, attribute);
            while (references.next()) |reference| {
                const unescaped = try std.mem.replaceOwned(u8, allocator, reference, "&amp;", "&");
                const buffer_size = unescaped.len * 2 + relative.len + site_root.len + 256;
                var buffer = try allocator.alloc(u8, buffer_size);
                @memcpy(buffer[0..unescaped.len], unescaped);
                const uri = try std.Uri.resolveInPlace(base, unescaped.len, &buffer);
                if (!std.ascii.eqlIgnoreCase(uri.scheme, "https") or uri.host == null or
                    !std.ascii.eqlIgnoreCase(
                        try uri.host.?.toRawMaybeAlloc(allocator),
                        "site.invalid",
                    ) or (uri.port != null and uri.port.? != 443)) continue;
                var target = try sitePath(allocator, uri.path.percent_encoded, prefix);
                var target_path = try std.fs.path.join(allocator, &.{ directory, target });
                const stat = std.Io.Dir.cwd().statFile(io, target_path, .{}) catch
                    return error.MissingLocalReference;
                if (stat.kind == .directory) {
                    target = try std.fs.path.join(allocator, &.{ target, "index.html" });
                    target_path = try std.fs.path.join(allocator, &.{ directory, target });
                }
                if (!try files.exists(io, target_path)) return error.MissingLocalReference;
                if (uri.fragment) |fragment| if (!fragment.isEmpty()) {
                    const destination = pages.get(target) orelse return error.MissingFragment;
                    const identifier = try decode(allocator, fragment.percent_encoded);
                    if (!destination.identifiers.contains(identifier)) return error.MissingFragment;
                };
                result.references += 1;
            }
        }
    }
    return result;
}

/// Reject overlapping page and asset destinations before Zine writes.
pub fn preflight(allocator: std.mem.Allocator, io: std.Io, directory: []const u8) !void {
    var destinations: std.StringHashMapUnmanaged(void) = .empty;
    const asset_directory = try std.fs.path.join(allocator, &.{ directory, "assets" });
    for (try files.list(allocator, io, asset_directory)) |relative| {
        if ((try destinations.getOrPut(allocator, relative)).found_existing)
            return error.AssetCollision;
    }
    var pages: std.StringHashMapUnmanaged(void) = .empty;
    const content_directory = try std.fs.path.join(allocator, &.{ directory, "content" });
    for (try files.list(allocator, io, content_directory)) |relative| {
        if (!std.mem.endsWith(u8, relative, ".smd")) {
            if ((try destinations.getOrPut(allocator, relative)).found_existing)
                return error.AssetCollision;
            continue;
        }
        var stem = relative[0 .. relative.len - 4];
        if (std.mem.eql(u8, stem, "index")) {
            stem = "";
        } else if (std.mem.endsWith(u8, stem, "/index")) {
            stem = stem[0 .. stem.len - 6];
        }
        const destination = try std.fs.path.join(allocator, &.{ stem, "index.html" });
        if ((try pages.getOrPut(allocator, destination)).found_existing)
            return error.DuplicatePageRoute;
        if ((try destinations.getOrPut(allocator, destination)).found_existing)
            return error.PageAssetCollision;
    }
    _ = try files.list(allocator, io, try std.fs.path.join(allocator, &.{ directory, "layouts" }));
}

/// A null output selects the loopback development server; releases use staging.
fn arguments(
    allocator: std.mem.Allocator,
    options: Options,
    output: ?[]const u8,
) ![]const []const u8 {
    var command: std.ArrayList([]const u8) = .empty;
    try command.append(allocator, try std.fs.path.resolve(allocator, &.{options.zine_executable}));
    if (output) |directory| {
        try command.appendSlice(allocator, &.{
            "release", try std.fmt.allocPrint(allocator, "--output={s}", .{directory}),
        });
    } else try command.appendSlice(allocator, &.{
        "--host=127.0.0.1", "--port=1990", "--url-path-prefix=",
    });
    return command.toOwnedSlice(allocator);
}

fn indexSearch(allocator: std.mem.Allocator, io: std.Io, staging: []const u8) !void {
    const bundle = try std.fs.path.join(allocator, &.{ staging, "pagefind" });
    if (try files.exists(io, bundle)) return error.PagefindOutputCollision;
    var indexer = std.process.spawn(io, .{
        .argv = &.{ "pagefind", "--site", staging, "--output-path", bundle },
        .cwd = .{ .path = staging },
        .stdout = .ignore, // Test runners reserve stdout for their protocol.
    }) catch |failure| {
        if (failure == error.FileNotFound) {
            std.log.err("Install Pagefind 1.6.0 and add pagefind to PATH.", .{});
        }
        return failure;
    };
    defer indexer.kill(io);
    if (!(try indexer.wait(io)).success()) return error.PagefindFailed;
    for ([_][]const u8{ "pagefind-entry.json", "pagefind.js" }) |asset| {
        const path = try std.fs.path.join(allocator, &.{ bundle, asset });
        if (!try files.exists(io, path)) return error.MissingPagefindBundle;
    }
}

/// Own the release subprocesses and staging directory. Render, indexing, and
/// validation failures preserve the previous output; failed renames restore it.
pub fn build(allocator: std.mem.Allocator, io: std.Io, options: Options) !Result {
    try preflight(allocator, io, options.site_directory);
    const destination = try std.fs.path.resolveAlloc(allocator, &.{
        try std.process.currentPathAlloc(io, allocator), options.output_directory,
    });
    const staging = try files.staging(allocator, io, destination);
    defer std.Io.Dir.cwd().deleteTree(io, staging) catch {};
    var child = try std.process.spawn(io, .{
        .argv = try arguments(allocator, options, staging),
        .cwd = .{ .path = options.site_directory },
        .stderr = options.engine_stderr,
    });
    defer child.kill(io);
    if (!(try child.wait(io)).success()) return error.ZineFailed;
    try indexSearch(allocator, io, staging);
    const result = try validate(allocator, io, staging);
    const backup = try std.fmt.allocPrint(allocator, "{s}.previous", .{staging});
    const had_previous = try files.exists(io, destination);
    if (had_previous) try std.Io.Dir.cwd().rename(destination, .cwd(), backup, io);
    std.Io.Dir.cwd().rename(staging, .cwd(), destination, io) catch |failure| {
        if (had_previous) try std.Io.Dir.cwd().rename(backup, .cwd(), destination, io);
        return failure;
    };
    if (had_previous) try std.Io.Dir.cwd().deleteTree(io, backup);
    return result;
}

/// Replace the coordinator with Zine so Ctrl+C reaches the live server directly.
/// Source, layout, and asset changes reload; native artifacts require a rebuild.
pub fn serve(allocator: std.mem.Allocator, io: std.Io, options: Options) !void {
    try preflight(allocator, io, options.site_directory);
    return std.process.replace(io, .{
        .argv = try arguments(allocator, options, null),
        .cwd = .{ .path = options.site_directory },
    });
}
