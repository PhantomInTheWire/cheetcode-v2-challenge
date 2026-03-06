import { describe, expect, it } from "vitest";
import {
  buildLevel3NativeSandboxRunner,
  buildLevel3SandboxRuntimeRunner,
} from "../server/level3/sandboxRunner";

describe("level3 sandbox runner", () => {
  it("includes language support assets in runtime compile scripts", () => {
    const cRunner = buildLevel3SandboxRuntimeRunner("cpu-16bit-emulator", "C");
    expect(cRunner).toContain('"support.c"');
    expect(cRunner).toContain('["main.c", ...supportFilenames, "harness.c", "-o", "harness"]');

    const cppRunner = buildLevel3SandboxRuntimeRunner("cpu-16bit-emulator", "C++");
    expect(cppRunner).toContain('"support.cpp"');
    expect(cppRunner).toContain('["main.cpp", ...supportFilenames, "harness.c", "-o", "harness"]');

    const rustRunner = buildLevel3SandboxRuntimeRunner("cpu-16bit-emulator", "Rust");
    expect(rustRunner).toContain('"support.rs"');
    expect(rustRunner).toContain('"libsupport" + idx + ".a"');
  });

  it("writes support assets in native bootstrap runner", () => {
    const native = buildLevel3NativeSandboxRunner("cpu-16bit-emulator", "Rust");
    expect(native).toContain('fs.writeFileSync("harness.c", HARNESS_SOURCE, "utf8")');
    expect(native).toContain('fs.writeFileSync("support.rs", SUPPORT_SOURCE_0, "utf8")');
  });

  it("omits support assets for tasks without auxiliary sources", () => {
    const runtime = buildLevel3SandboxRuntimeRunner("identity-bundle-auth-resolver", "C");
    expect(runtime).toContain("const supportFilenames = [];");
    expect(runtime).toContain('["main.c", ...supportFilenames, "harness.c", "-o", "harness"]');

    const native = buildLevel3NativeSandboxRunner("identity-bundle-auth-resolver", "Rust");
    expect(native).toContain('fs.writeFileSync("harness.c", HARNESS_SOURCE, "utf8")');
    expect(native).not.toContain("SUPPORT_SOURCE_0");
  });
});
