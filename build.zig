//! zvm-lock: 0.17.0
//! Render with Zine, index with Pagefind, and validate the static site.
const std = @import("std");

comptime {
    const required_version = @import("build.zig.zon").minimum_zig_version;
    if (!std.mem.eql(u8, @import("builtin").zig_version_string, required_version)) {
        @compileError("This site requires Zig " ++ required_version ++ ".");
    }
}

pub fn build(builder: *std.Build) void {
    const pagefind_executable = pagefindExecutable(builder) orelse return;

    const zine = builder.dependency("zine", .{
        .target = builder.graph.host,
        .optimize = .ReleaseFast,
        .@"no-git-version" = true,
        .highlight = false,
    }).artifact("zine");
    const coordinator = builder.addExecutable(.{
        .name = "zml-site",
        .root_module = builder.createModule(.{
            .root_source_file = builder.path("tools/site.zig"),
            .target = builder.graph.host,
            .optimize = .ReleaseSafe,
        }),
    });
    const paths = builder.addOptions();
    paths.addOptionPath("zine_executable", zine.getEmittedBin());
    paths.addOptionPath("pagefind_executable", pagefind_executable);
    coordinator.root_module.addOptions("paths", paths);

    const release = builder.addRunArtifact(coordinator);
    release.addArg("build");
    release.addArtifactArg2(zine, .{ .make_absolute = true });
    release.setCwd(builder.path("."));
    release.has_side_effects = true;
    builder.getInstallStep().dependOn(&release.step);

    const preview = builder.addRunArtifact(coordinator);
    preview.addArg("serve");
    preview.addArtifactArg2(zine, .{ .make_absolute = true });
    preview.setCwd(builder.path("."));
    preview.has_side_effects = true;
    builder.step("serve", "Preview at http://127.0.0.1:1990/").dependOn(&preview.step);

    const check = builder.addRunArtifact(coordinator);
    check.addArgs(&.{ "check", "dist" });
    check.setCwd(builder.path("."));
    check.has_side_effects = true;
    check.step.dependOn(&release.step);
    builder.step("check", "Build and validate the generated site").dependOn(&check.step);

    const tests = builder.addTest(.{
        .root_module = builder.createModule(.{
            .root_source_file = builder.path("tools/tests.zig"),
            .target = builder.graph.host,
            .optimize = .Debug,
        }),
    });
    tests.root_module.addOptions("paths", paths);
    const run_tests = builder.addRunArtifact(tests);
    run_tests.setCwd(builder.path("."));
    const test_step = builder.step("test", "Test validation and preserve the last valid build");
    test_step.dependOn(&run_tests.step);
    test_step.dependOn(&check.step);
}

fn pagefindExecutable(builder: *std.Build) ?std.Build.LazyPath {
    const host = builder.graph.host.result;
    const pagefind_platform = switch (host.os.tag) {
        .macos => "macos",
        .linux => "linux",
        .windows => "windows",
        .freebsd => "freebsd",
        else => @panic("Pagefind 1.6.0 has no binary for this host OS"),
    };
    switch (host.cpu.arch) {
        .aarch64, .x86_64 => {},
        else => @panic("Pagefind 1.6.0 has no binary for this host architecture"),
    }
    if (host.os.tag == .freebsd and host.cpu.arch != .x86_64)
        @panic("Pagefind 1.6.0 only supports x86_64 on FreeBSD");
    const pagefind = builder.lazyDependency(builder.fmt("pagefind_{s}_{s}", .{
        pagefind_platform, @tagName(host.cpu.arch),
    }), .{}) orelse return null;
    return pagefind.path(if (host.os.tag == .windows) "pagefind.exe" else "pagefind");
}
