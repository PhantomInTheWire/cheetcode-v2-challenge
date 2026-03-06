# Firefox / Gecko Configuration

## Project: Firefox (Gecko)

Source: `/Users/ghost/firefox`
Output: `data/firefox-questions.json`
Extensions: `*.cpp, *.h, *.rs, *.idl, *.jsm, *.sys.mjs`
ID Prefix: `ff_`

### Architecture Layers

Firefox/Gecko has a well-defined layer cake. Questions describe the top; answers live at the bottom.

```
User action (browser chrome UI, web page behavior)
  -> Browser frontend (browser/, toolkit/components/)
    -> DOM / Content layer (dom/, docshell/)
      -> Layout / Style engine (layout/, servo/components/style/)
        -> Network / Security (netwerk/, security/)
          -> Platform services (xpcom/, storage/, gfx/, js/src/)
            -> THE ANSWER: enum/error/constant
```

### Synonym Table

| Internal Term                        | Use Instead                                    |
| ------------------------------------ | ---------------------------------------------- |
| XPCOM                                | cross-platform component binding framework     |
| nsresult                             | status disposition code                        |
| nsISupports                          | root component interface                       |
| Necko (netwerk)                      | network transport stack                        |
| SpiderMonkey                         | script execution engine                        |
| WebRender                            | GPU-driven composition pipeline                |
| Stylo                                | parallel style computation engine              |
| Gecko                                | rendering engine core                          |
| content process                      | isolated page execution sandbox                |
| chrome process (parent)              | main orchestrator process                      |
| IPDL                                 | inter-process protocol schema language         |
| Fission                              | site-isolation architecture                    |
| Electrolysis (e10s)                  | multi-process separation layer                 |
| Marionette                           | remote automation driver                       |
| GeckoView                            | embedded rendering surface                     |
| about:config                         | internal preference editor                     |
| Places                               | history and bookmark database                  |
| Telemetry probe                      | usage measurement beacon                       |
| Breakpad / Crashpad                  | fault analysis collector                       |
| Normandy                             | remote experiment orchestrator                 |
| Nimbus                               | feature experimentation framework              |
| APZ (Async Pan/Zoom)                 | asynchronous scroll compositor                 |
| TRR (Trusted Recursive Resolver)     | encrypted name resolution proxy                |
| HSTS                                 | transport upgrade persistence policy           |
| CSP (Content Security Policy)        | page resource restriction ruleset              |
| SRI (Subresource Integrity)          | fetched resource fingerprint check             |
| ETP (Enhanced Tracking Protection)   | cross-site surveillance shield                 |
| service worker                       | background page helper agent                   |
| IndexedDB                            | structured client-side object store            |
| Quota Manager                        | local storage capacity enforcer                |
| WebAuthn / FIDO                      | site identity proof ceremony                   |
| Push API                             | server-initiated notification channel          |
| WebTransport                         | multiplexed low-latency data conduit           |
| WebCrypto                            | in-page cryptographic toolkit                  |
| gamepad                              | physical game controller peripheral            |
| geolocation                          | geographic position sensor                     |
| certificate (X.509)                  | cryptographic identity credential              |
| OCSP                                 | credential revocation live check               |
| NSS                                  | cryptographic foundation library               |
| Cookie                               | site-deposited tracking morsel                 |
| iframe                               | embedded interactive sub-frame                 |
| SharedArrayBuffer                    | concurrent memory region                       |
| WebGPU                               | accelerated graphics computation interface     |
| JIT (IonMonkey/Baseline)             | runtime code generation optimizer              |
| GC (garbage collection)              | automatic memory reclamation cycle             |
| Wasm                                 | portable bytecode execution format             |
| CUPS                                 | operating system print dispatch service        |
| XR / WebXR                           | immersive spatial rendering session            |

### Hotspot Areas

#### XPCOM / Core Errors

- `xpcom/base/ErrorList.py` -- master NS_ERROR_* code registry (nsresult values)
- `xpcom/base/nsError.h` -- error generation macros, severity/module encoding
- `xpcom/base/ErrorNames.cpp` -- error code to name mapping
- `xpcom/ds/` -- data structure utilities, observer service
- `xpcom/components/` -- component registration, categories

#### Network (Necko)

- `netwerk/base/nsIOService.cpp` -- I/O service, offline state management
- `netwerk/protocol/http/nsHttpChannel.cpp` -- main HTTP channel implementation
- `netwerk/protocol/http/nsHttpConnectionMgr.cpp` -- connection pooling, pipelining
- `netwerk/protocol/http/Http2Session.cpp` -- HTTP/2 multiplexing, frame errors
- `netwerk/protocol/http/Http3Session.cpp` -- HTTP/3 QUIC session management
- `netwerk/protocol/http/AlternateServices.cpp` -- Alt-Svc, protocol negotiation
- `netwerk/protocol/websocket/` -- WebSocket protocol implementation
- `netwerk/protocol/webtransport/` -- WebTransport session management
- `netwerk/cookie/CookieService.cpp` -- cookie parsing, validation, storage
- `netwerk/cookie/CookieValidation.cpp` -- cookie attribute validation rules
- `netwerk/dns/TRR.cpp` -- DNS-over-HTTPS (Trusted Recursive Resolver)
- `netwerk/dns/nsHostResolver.cpp` -- DNS resolution, caching, Happy Eyeballs
- `netwerk/cache2/` -- disk/memory cache subsystem
- `netwerk/url-classifier/` -- URL classification for safe browsing

#### Security / Certificates (NSS)

- `security/manager/ssl/nsNSSIOLayer.cpp` -- TLS handshake integration
- `security/manager/ssl/SSLServerCertVerification.cpp` -- server cert verification
- `security/manager/ssl/nsSiteSecurityService.cpp` -- HSTS, public key pinning
- `security/manager/ssl/TransportSecurityInfo.cpp` -- connection security state
- `security/manager/ssl/nsNSSComponent.cpp` -- NSS initialization, shutdown
- `security/manager/ssl/nsCertOverrideService.cpp` -- user certificate exceptions
- `security/manager/ssl/NSSErrorsService.cpp` -- NSS error code mapping
- `security/certverifier/CertVerifier.cpp` -- certificate chain verification
- `security/certverifier/OCSPCache.cpp` -- OCSP response caching
- `security/certverifier/NSSCertDBTrustDomain.cpp` -- trust anchor policy

#### DOM / Content

- `dom/base/` -- core DOM node, document, element implementation
- `dom/security/nsCSPContext.cpp` -- Content Security Policy evaluation
- `dom/security/nsCSPParser.cpp` -- CSP directive parsing
- `dom/security/nsMixedContentBlocker.cpp` -- mixed content detection/blocking
- `dom/security/SRICheck.cpp` -- Subresource Integrity hash verification
- `dom/security/ReferrerInfo.cpp` -- referrer policy enforcement
- `dom/fetch/FetchDriver.cpp` -- Fetch API implementation, CORS
- `dom/serviceworkers/ServiceWorkerManager.cpp` -- SW lifecycle management
- `dom/serviceworkers/ServiceWorkerUpdateJob.cpp` -- SW update state machine
- `dom/workers/WorkerPrivate.cpp` -- Web Worker lifecycle, error handling
- `dom/notification/Notification.cpp` -- Notification API
- `dom/push/PushService.sys.mjs` -- Push API subscription management
- `dom/geolocation/Geolocation.cpp` -- Geolocation API, permission handling
- `dom/permission/PermissionStatus.cpp` -- Permissions API status tracking

#### IndexedDB / Storage

- `dom/indexedDB/ActorsParent.cpp` -- IDB parent-process operations, error codes
- `dom/indexedDB/IDBDatabase.cpp` -- database open/close/version lifecycle
- `dom/indexedDB/IDBFactory.cpp` -- database factory, open requests
- `dom/indexedDB/DBSchema.cpp` -- on-disk schema, upgrade errors
- `dom/quota/QuotaManager.h` -- storage quota enforcement
- `dom/quota/Client.cpp` -- per-origin quota client interface
- `storage/mozStorageConnection.cpp` -- SQLite connection wrapper, errors
- `storage/mozStorageError.cpp` -- storage error codes

#### SpiderMonkey (JavaScript Engine)

- `js/src/vm/Opcodes.h` -- bytecode opcode definitions (FOR_EACH_OPCODE)
- `js/src/vm/ErrorReporting.cpp` -- JS error generation and propagation
- `js/src/vm/ThrowMsgKind.h` -- internal throw message categories
- `js/src/frontend/Parser.cpp` -- JavaScript parser, syntax errors
- `js/src/frontend/BytecodeEmitter.cpp` -- bytecode generation
- `js/src/frontend/TokenKind.h` -- lexer token types
- `js/src/jit/Bailouts.cpp` -- JIT bailout reasons (deoptimization)
- `js/src/jit/IonIC.cpp` -- inline cache stubs, polymorphic dispatch
- `js/src/gc/` -- garbage collector phases, states, OOM errors
- `js/src/wasm/` -- WebAssembly validation, compilation, trap codes

#### Layout / Rendering (Gecko)

- `layout/base/` -- frame construction, reflow pipeline
- `layout/generic/` -- generic frame types, block/inline reflow
- `layout/style/ServoStyleSet.cpp` -- Stylo integration, style resolution
- `layout/style/ComputedStyle.cpp` -- computed style value access
- `layout/style/RestyleManager.cpp` -- incremental restyle scheduling
- `layout/style/nsChangeHint.h` -- change hint flags for restyle
- `layout/painting/` -- display list construction, painting
- `layout/printing/` -- print-to-PDF, pagination, page breaks

#### Stylo (Servo CSS Engine)

- `servo/components/style/properties/` -- CSS property definitions (Rust)
- `servo/components/style/matching.rs` -- selector matching
- `servo/components/style/invalidation/` -- style invalidation logic
- `servo/components/style/error_reporting.rs` -- CSS parse error reporting
- `servo/components/style/gecko_bindings/` -- Gecko ↔ Servo FFI bridge

#### Graphics / Compositing

- `gfx/layers/` -- compositing layer tree, texture management
- `gfx/layers/composite/` -- compositor implementation
- `gfx/layers/apz/src/` -- Async Pan/Zoom, overscroll, fling physics
- `gfx/layers/wr/` -- WebRender integration bindings
- `gfx/wr/webrender/` -- WebRender core rendering (Rust)
- `gfx/wr/webrender_api/` -- WebRender display list API
- `gfx/thebes/` -- Thebes graphics abstraction (platform drawing)
- `gfx/2d/` -- Moz2D drawing API, path/surface types
- `gfx/gl/` -- OpenGL context management, extension probing

#### IPC / Multi-Process

- `ipc/glue/MessageChannel.cpp` -- IPC message dispatch, error handling
- `ipc/glue/GeckoChildProcessHost.cpp` -- child process launch, sandboxing
- `ipc/glue/ProtocolUtils.cpp` -- IPDL protocol base utilities
- `ipc/glue/BackgroundImpl.cpp` -- PBackground IPC thread
- `ipc/ipdl/` -- IPDL protocol compiler, schema definitions
- `dom/ipc/` -- ContentParent/ContentChild (main content IPC actors)

#### WebAuthn / FIDO

- `dom/webauthn/WebAuthnService.cpp` -- WebAuthn service dispatch
- `dom/webauthn/WebAuthnHandler.cpp` -- authenticator request handling
- `dom/webauthn/AuthenticatorAssertionResponse.cpp` -- assertion flow
- `dom/webauthn/authrs_bridge/` -- Rust authenticator bridge

#### Anti-Tracking / Privacy

- `toolkit/components/antitracking/StorageAccess.cpp` -- storage access decisions
- `toolkit/components/antitracking/ContentBlockingLog.cpp` -- blocking event log
- `toolkit/components/antitracking/bouncetrackingprotection/` -- bounce tracking
- `netwerk/cookie/CookieCommons.cpp` -- cookie SameSite, partitioning logic

#### Extensions (WebExtensions)

- `toolkit/components/extensions/ExtensionPolicyService.cpp` -- policy enforcement
- `toolkit/components/extensions/Extension.sys.mjs` -- extension lifecycle
- `toolkit/components/extensions/ExtensionParent.sys.mjs` -- parent-process API
- `toolkit/components/extensions/ExtensionDNR.sys.mjs` -- declarative net request
- `toolkit/components/extensions/schemas/` -- WebExtension API JSON schemas
- `toolkit/components/extensions/webrequest/` -- webRequest API interception

#### Crash Reporting / Telemetry

- `toolkit/crashreporter/` -- Breakpad/Crashpad crash handling
- `toolkit/components/telemetry/Histograms.json` -- histogram definitions
- `toolkit/components/telemetry/Scalars.yaml` -- scalar probe definitions
- `toolkit/components/telemetry/Events.yaml` -- event telemetry definitions
- `toolkit/components/normandy/` -- Normandy recipe runner (experiments)
- `toolkit/components/nimbus/` -- Nimbus experimentation (feature flags)

#### Browser Frontend

- `browser/components/` -- Firefox-specific UI features (sidebar, tabs, etc.)
- `browser/base/` -- browser window, tab management, urlbar
- `browser/actors/` -- browser JSWindowActors (parent/child messaging)
- `toolkit/components/places/` -- Places DB (history, bookmarks, favicons)
- `toolkit/components/passwordmgr/` -- login/password manager
- `toolkit/components/sessionstore/` -- session save/restore

#### Platform Widgets

- `widget/cocoa/` -- macOS native widget integration (*.mm)
- `widget/windows/` -- Windows native widget integration
- `widget/gtk/` -- GTK/Linux widget integration
- `widget/android/` -- Android widget layer (GeckoView)
- `widget/nsIWidget.h` -- cross-platform widget interface

#### Hardware Abstraction

- `hal/` -- battery, sensors, screen orientation, wake locks
- `hal/HalSensor.h` -- sensor type enums
- `hal/HalTypes.h` -- hardware abstraction type definitions

#### Media Playback

- `dom/media/` -- media element, decoder pipeline, audio graph
- `dom/media/MediaFormatReader.cpp` -- demuxer/decoder negotiation
- `dom/media/MediaDecoder.cpp` -- playback state machine
- `media/webrtc/signaling/` -- WebRTC signaling, SDP, ICE
- `third_party/libwebrtc/` -- upstream WebRTC library
- `dom/media/webaudio/` -- Web Audio API nodes and processing

#### Remote Automation

- `remote/marionette/` -- Marionette automation protocol
- `remote/webdriver-bidi/` -- WebDriver BiDi protocol
- `remote/server/` -- remote debugging server

#### WebGPU / Canvas

- `dom/webgpu/` -- WebGPU API bindings, adapter/device/queue
- `dom/canvas/` -- Canvas 2D context, WebGL context
- `gfx/wgpu_bindings/` -- wgpu Rust bindings for WebGPU backend
