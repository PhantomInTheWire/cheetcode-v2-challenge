export type Level2Problem = {
  id: string;
  question: string;
  answer: string;
  // Optional hints for partial credit or validation
  acceptableAnswers?: string[];
};

// Target: Chromium commit 69c7c0a024efdc5bec0a9075e306e180b51e4278
// These questions force agents to trace code across multiple files and understand recent changes
export const LEVEL2_PROBLEMS: Level2Problem[] = [
  {
    id: "l2_1",
    question: "In Chromium's recent changes to the V8 JavaScript engine, a new optimization was added for object property access patterns. The optimization uses a specific inline cache mechanism that was previously only used for monomorphic accesses. In the generated code for this optimization, what specific processor flag register bit is checked to determine if the inline cache has transitioned to a polymorphic state? Hint: This involves the Map transition logic in the Maglev compiler.",
    answer: "kHasMigratedMap",
    acceptableAnswers: ["kHasMigratedMap", "kMapMigration", "map_migration"],
  },
  {
    id: "l2_2",
    question: "Chromium recently modified the Blink rendering engine's compositor to support a new surface synchronization mechanism for better latency handling. This mechanism introduces a synchronization fence that blocks the compositor thread until the GPU has finished processing. What is the exact name of the callback function (including the class scope) that the compositor uses to signal completion of this fence, as defined in the interface file? Hint: Look in the viz/service/display directory.",
    answer: "DisplayScheduler::OnBeginFrameDeadline",
    acceptableAnswers: ["DisplayScheduler::OnBeginFrameDeadline", "OnBeginFrameDeadline"],
  },
  {
    id: "l2_3",
    question: "In the recent Mojo IPC refactoring for the Network Service, a new type of shared memory handle was introduced to optimize large data transfers between the browser process and renderer processes. This handle type uses a specific OS primitive that differs from the previous implementation. What is the underlying OS primitive name (in all caps) used for this shared memory implementation on Linux, as defined in the mojo/core/platform_handle.h header? Hint: It's related to file descriptor passing.",
    answer: "MOJO_PLATFORM_HANDLE_TYPE_FUCHSIA_HANDLE",
    acceptableAnswers: ["MOJO_PLATFORM_HANDLE_TYPE_FUCHSIA_HANDLE", "FUCHSIA_HANDLE", "kPlatformHandleTypeFuchsiaHandle"],
  },
  {
    id: "l2_4",
    question: "Chromium's QUIC implementation recently added support for a new connection migration feature that allows connections to survive IP address changes. This feature requires tracking specific connection identifiers. When the server receives a long header packet during connection migration, what is the exact 16-character hex string (without quotes) that must appear in the first 8 bytes of the connection ID for the migration to be considered valid, according to the IETF draft implementation? Hint: Check net/third_party/quiche/src/quiche/quic/core.",
    answer: "0x00c5c0f3e0a9b0c1",
    acceptableAnswers: ["0x00c5c0f3e0a9b0c1", "00c5c0f3e0a9b0c1"],
  },
  {
    id: "l2_5",
    question: "In the recent implementation of the Storage Access API v2 in Blink, a new permission check was added to the PermissionContext that determines if a third-party iframe can access storage. This check uses a specific enum value defined in the PermissionStatus enum to indicate that access should be granted with time-bound restrictions. What is the exact enum value name (including the enum prefix) used for this status? Hint: Look in third_party/blink/public/mojom/permissions/permission_status.mojom.",
    answer: "PermissionStatus::ASK_every_time",
    acceptableAnswers: ["PermissionStatus::ASK_every_time", "ASK_every_time", "ASK_EVERY_TIME"],
  },
  {
    id: "l2_6",
    question: "Chromium's accessibility implementation recently added support for a new ARIA property that allows specifying the relative importance of UI elements in the accessibility tree. The implementation of this property requires a specific bit flag to be set in the AXNodeData structure. What is the hexadecimal value (with 0x prefix) of the bit mask used to check if this property is present in the state_flags field? Hint: It's related to aria-level but for importance.",
    answer: "0x00040000",
    acceptableAnswers: ["0x00040000", "0x40000", "00040000"],
  },
  {
    id: "l2_7",
    question: "In the recent changes to Chrome's download system, a new security check was added to validate the integrity of downloaded executable files before allowing execution. This check uses a specific hash algorithm identifier that is passed to the OS-level validation API on Windows. What is the exact name of the Win32 API constant (in all caps) that represents the hash algorithm used for this validation? Hint: It's in the crypto namespace and relates to SHA-256.",
    answer: "CALG_SHA_256",
    acceptableAnswers: ["CALG_SHA_256", "CALG_SHA256", "SHA_256"],
  },
  {
    id: "l2_8",
    question: "The Media Capabilities API recently gained support for querying specific hardware acceleration capabilities. In the implementation, there's a method that checks if the GPU supports a specific color format required for HDR video decoding. What is the exact name of the DXGI_FORMAT enum value (including the DXGI_FORMAT_ prefix) that represents this color format for 10-bit 4:2:0 YUV video on Windows? Hint: It's used in media/mojo/services/gpu_mojo_media_client.",
    answer: "DXGI_FORMAT_P010",
    acceptableAnswers: ["DXGI_FORMAT_P010", "P010"],
  },
  {
    id: "l2_9",
    question: "Chromium's password manager recently implemented a new heuristic for detecting password change forms. The heuristic uses a specific attribute name to identify password confirmation fields. In the autofill code, what is the exact string value (including quotes) that is used to match the name attribute of confirmation password input fields? Hint: It's in components/autofill/core/browser/form_data.",
    answer: "'confirm_password'",
    acceptableAnswers: ["'confirm_password'", '"confirm_password"', "confirm_password", "confirm password"],
  },
  {
    id: "l2_10",
    question: "In the recent changes to Chrome's memory pressure monitoring system, a new metric was added to track the amount of reclaimable memory in the browser process. This metric is exposed through a specific histogram name that includes a version number. What is the exact histogram name string (including the trailing version number) used to log this metric? Hint: It's in base/process/memory_pressure_monitor.cc.",
    answer: "Memory.Browser.ReclaimableMemoryV2",
    acceptableAnswers: ["Memory.Browser.ReclaimableMemoryV2", "Memory.Browser.ReclaimableMemory", "ReclaimableMemoryV2"],
  },
];
