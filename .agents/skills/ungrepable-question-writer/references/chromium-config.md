# Chromium Configuration

## Project: Chromium
Source: `/Users/ghost/chromium/src`
Output: `data/level2-questions.json`
Extensions: `*.cc, *.h, *.mm, *.mojom`
ID Prefix: `l2_`

### Architecture Layers

Chromium has a well-defined layer cake. Questions describe the top; answers live at the bottom.

```
User-visible action (browser UI, web page behavior)
  -> Blink renderer (third_party/blink/renderer/)
    -> IPC boundary (content/browser/, *.mojom)
      -> Chrome feature layer (chrome/browser/<feature>/)
        -> Shared component (components/<feature>/)
          -> Platform/service primitive (services/, device/, net/, base/)
            -> THE ANSWER: enum/error/constant
```

### Synonym Table

| Internal Term              | Use Instead                                |
| -------------------------- | ------------------------------------------ |
| clipboard                  | system buffer                              |
| IndexedDB                  | local database                             |
| service worker             | background helper process                  |
| gamepad                    | physical game controller                   |
| Safe Browsing              | safety database                            |
| enterprise policy          | organizational security rules              |
| DLP                        | data governance rules                      |
| content analysis connector | remote content inspection service          |
| interstitial               | warning barrier page                       |
| CRX                        | signed software package                    |
| Chrome updater             | software self-renewal mechanism            |
| group policy / GPO         | machine administrative configuration       |
| DM server                  | central device management server           |
| DM token                   | enrollment credentials                     |
| policy merge               | configuration rule precedence resolution   |
| cloud policy fetch         | administrative settings distribution       |
| device attestation         | hardware integrity proof                   |
| device trust signals       | security posture signals                   |
| watermark                  | visible ownership marking overlay          |
| Bluetooth                  | short-range wireless radio                 |
| iframe                     | embedded interactive frame                 |
| metered connection         | bandwidth-metered network                  |
| WebRTC                     | real-time media channel                    |
| certificate                | cryptographic credential                   |
| signing key rotation       | signing authority credential rotation      |
| policy validation          | configuration payload integrity check      |
| Secure Enclave             | tamper-resistant hardware key vault        |
| Keystone                   | legacy software update framework           |
| launchd / launch agent     | system's background job scheduler          |
| XPC / privileged helper    | elevated-privilege installation assistant  |
| MDM profile                | fleet-administered configuration profile   |
| Touch ID / LAContext       | device's biometric verification prompt     |
| Keychain                   | operating system's credential vault        |
| AVFoundation               | system's video acquisition subsystem       |
| NSUserDefaults             | application's persistent settings store    |
| SSO / Entra ID             | organization's federated identity provider |
| Keystone ticket            | legacy update registration record          |
| WebAuthn / FIDO            | site identity proof protocol               |
| FIDO authenticator         | portable hardware credential device        |
| USB                        | tethered peripheral                        |
| HID                        | human-operated input peripheral            |
| GATT / BLE service         | wireless service attribute                 |
| print preview              | page composition preview                   |
| duplex printing            | double-sided reproduction                  |
| Payment Request API        | merchant checkout ceremony                 |
| credit card                | financial transaction instrument           |
| Serial port                | wired data link                            |

### Hotspot Areas

#### Enterprise
- `chrome/browser/enterprise/data_controls/` -- DLP clipboard/paste/print
- `chrome/browser/enterprise/connectors/analysis/` -- content scanning
- `chrome/browser/enterprise/connectors/device_trust/` -- device attestation
- `chrome/browser/enterprise/data_protection/` -- URL-based protection
- `chrome/browser/enterprise/reporting/` -- event reporting
- `chrome/browser/enterprise/watermark/` -- watermarking
- `chrome/browser/enterprise/platform_auth/` -- SSO/Entra, URL session auth

#### Policy
- `components/policy/core/common/cloud/` -- cloud policy fetch/validate/store
- `components/policy/core/common/` -- merge, schema validation
- `components/policy/proto/` -- wire format

#### Updater
- `chrome/updater/` -- update checking, blocking, installation
- `components/update_client/` -- protocol, states, errors

#### Device Trust
- `components/enterprise/device_trust/` -- attestation flow, key management
- `components/enterprise/device_attestation/` -- attestation primitives

#### FIDO / WebAuthn
- `device/fido/` -- CTAP2, authenticator management, auth token requester
- `device/fido/mac/` -- Touch ID, Secure Enclave FIDO
- `device/fido/win/` -- Windows Hello
- `device/fido/cable/` -- caBLE (phone as authenticator)
- `content/browser/webauth/` -- browser-side WebAuthn

#### Bluetooth
- `device/bluetooth/` -- platform Bluetooth abstractions
- `content/browser/bluetooth/` -- browser-process Bluetooth
- `third_party/blink/renderer/modules/bluetooth/` -- Blink Web Bluetooth

#### Media Capture
- `media/capture/video/` -- video capture abstractions
- `media/capture/video/apple/` -- macOS AVFoundation (*.mm)
- `media/capture/video/win/` -- Windows MediaFoundation
- `content/browser/renderer_host/media/` -- media stream management

#### USB / HID / Serial
- `services/device/usb/` -- USB service layer
- `services/device/hid/` -- HID service layer
- `services/device/serial/` -- Serial service
- `chrome/browser/usb/` -- Chrome USB permissions
- `chrome/browser/hid/` -- Chrome HID permissions

#### Network / Certificates
- `net/cert/` -- certificate verification, CT, path building
- `net/ssl/` -- SSL client, handshake errors
- `net/base/` -- net error codes (net_error_list.h)
- `net/http/` -- HTTP auth, transport security (HSTS)

#### Extensions
- `extensions/browser/` -- extension loading, install, management
- `extensions/common/` -- manifest parsing, permissions, errors
- `extensions/browser/install/` -- CRX install pipeline

#### Printing
- `printing/` -- core printing library, backends
- `chrome/browser/printing/` -- Chrome print UI
- `printing/backend/` -- platform backends (CUPS, Win GDI)

#### Payments
- `components/payments/` -- payment request handling
- `third_party/blink/renderer/modules/payments/` -- Blink Payment Request
- `components/autofill/core/browser/payments/` -- autofill payments

#### macOS Objective-C (*.mm) -- platform edge cases
- `chrome/browser/enterprise/connectors/device_trust/key_management/core/mac/`
- `chrome/updater/mac/setup/` -- Keystone migration, wake tasks, launchd
- `chrome/updater/mac/keystone/` -- legacy ksadmin/ksinstall compat
- `chrome/updater/mac/privileged_helper/` -- XPC helper, authorization
- `device/fido/mac/` -- Touch ID, Secure Enclave FIDO
- `media/capture/video/apple/` -- AVFoundation capture edge cases
