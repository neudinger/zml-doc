//! Package the Zig sources used by the browser's ZML API viewer.
const std = @import("std");
const files = @import("files.zig");

pub fn main(init: std.process.Init) !void {
    const allocator = init.arena.allocator();
    const io = init.io;
    const args = try init.minimal.args.toSlice(allocator);
    if (args.len != 3) return error.ExpectedSourceDirectoryAndOutput;

    const root = try std.Io.Dir.cwd().openDir(io, args[1], .{});
    defer root.close(io);
    const output = try std.Io.Dir.cwd().createFile(io, args[2], .{});
    defer output.close(io);
    var buffer: [8192]u8 = undefined;
    var writer = output.writer(io, &buffer);
    var tar: std.tar.Writer = .{ .underlying_writer = &writer.interface };

    // The first module in the tar is the viewer's home page. Keep the original
    // repository paths so the parser can resolve relative imports.
    for ([_][]const u8{
        "zml", "bazel", "dsl", "ffi", "mlir", "pjrt", "platforms", "stdx", "upb", "vfs",
    }) |module| {
        const directory = try std.fs.path.join(allocator, &.{ args[1], module });
        for (try files.list(allocator, io, directory)) |relative| {
            if (!std.mem.endsWith(u8, relative, ".zig")) continue;
            const path = try std.fmt.allocPrint(allocator, "{s}/{s}", .{ module, relative });
            try packFile(io, root, &tar, path);
        }
    }
    try packFile(io, root, &tar, "LICENSE");
    try tar.finishPedantically();
    try writer.interface.flush();
}

fn packFile(io: std.Io, root: std.Io.Dir, tar: *std.tar.Writer, path: []const u8) !void {
    const file = try root.openFile(io, path, .{});
    defer file.close(io);
    var buffer: [8192]u8 = undefined;
    var reader = file.reader(io, &buffer);
    try tar.writeFile(path, &reader, 0);
}
