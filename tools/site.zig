//! Native entry point for documentation build, preview, and output validation.
const std = @import("std");
const website = @import("website.zig");

pub const std_options: std.Options = .{ .log_level = .warn };

pub fn main(init: std.process.Init) !void {
    const paths = @import("paths");
    var arena = std.heap.ArenaAllocator.init(init.gpa);
    defer arena.deinit();
    const allocator = arena.allocator();
    const arguments = try init.minimal.args.toSlice(allocator);
    const Command = enum { build, serve, check };
    if (arguments.len != 3) return error.ExpectedCommandAndPath;
    const command = std.meta.stringToEnum(Command, arguments[1]) orelse
        return error.UnknownCommand;
    const options: website.Options = .{
        .zine_executable = arguments[2],
        .pagefind_executable = paths.pagefind_executable,
        .api_assets = .{ .wasm = paths.zml_api_wasm, .sources = paths.zml_api_sources },
    };
    if (command == .serve) return website.serve(allocator, init.io, options);
    const result = if (command == .build)
        try website.build(allocator, init.io, options)
    else
        try website.validate(allocator, init.io, arguments[2]);
    std.debug.print("Validated {d} pages and {d} local references.\n", .{
        result.pages, result.references,
    });
}
