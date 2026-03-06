# LibreOffice Configuration

## Project: LibreOffice

Source: `/Users/ghost/office`
Output: `data/libreoffice-questions.json`
Extensions: `*.cxx, *.hxx, *.h, *.idl`
ID Prefix: `lo_`

### Architecture Layers

LibreOffice has a module-per-directory layout with well-defined layers. Questions describe the top; answers live at the bottom.

```
User action (menu, toolbar, keyboard shortcut)
  -> Application shell (sfx2/framework/desktop)
    -> Application module (sw/sc/sd/starmath)
      -> Document model (SwDoc/ScDocument/SdDrawDocument)
        -> Shared libraries (svx/editeng/drawinglayer/formula/svl/svtools)
          -> Visual Class Library (vcl -- rendering, fonts, events, printing)
            -> System Abstraction Layer (sal/bridges/comphelper/tools)
              -> THE ANSWER: enum/error/constant
```

### Synonym Table

| Internal Term      | Use Instead                             |
| ------------------ | --------------------------------------- |
| VCL                | visual rendering toolkit                |
| UNO                | universal component interface           |
| SAL                | system abstraction foundation           |
| Writer (sw)        | long-document composition engine        |
| Calc (sc)          | tabular computation engine              |
| Impress (sd)       | slide presentation engine               |
| Draw               | vector illustration canvas              |
| Math (starmath)    | equation typesetting editor             |
| SfxObjectShell     | document container shell                |
| SdrObject          | geometric drawing primitive             |
| ScDocument         | spreadsheet data model                  |
| SwDoc              | document text model                     |
| SdDrawDocument     | presentation document model             |
| ODF                | open document interchange format        |
| OOXML              | proprietary office interchange format   |
| SDBC               | structured database connectivity bridge |
| StarBasic          | embedded macro scripting engine         |
| AutoText           | reusable text fragment library          |
| pivot table        | cross-tabulation summary matrix         |
| cell range         | rectangular grid selection              |
| master page        | slide template blueprint                |
| style              | formatting rule bundle                  |
| filter             | file format translator                  |
| macro              | user-defined automation script          |
| sidebar            | collapsible tool panel                  |
| toolbar            | action button strip                     |
| SvxShape           | universal shape wrapper                 |
| editeng            | rich text composition core              |
| drawinglayer       | vector rendering pipeline               |
| formula opcode     | spreadsheet function instruction code   |
| formula error code | computation failure signal              |
| SfxHint            | document change notification            |
| SwNode             | document content tree element           |
| SwTextNode         | paragraph content container             |
| ScAddress          | grid coordinate triplet                 |
| SfxItemSet         | attribute collection envelope           |
| SfxPoolItem        | typed formatting attribute              |
| hintid             | attribute type discriminator tag        |
| number format      | numeric display pattern                 |
| SvNumberFormatter  | locale-aware value display engine       |
| field (SwField)    | dynamic content placeholder             |
| undo               | action reversal record                  |
| xmloff             | structured document serializer          |
| oox                | foreign format bridge layer             |
| configmgr          | persistent settings registry            |
| UCB                | universal content access broker         |
| slideshow          | automated slide sequencer               |
| SfxDispatcher      | command routing controller              |
| SfxViewShell       | document viewport manager               |
| cui                | shared preference dialog collection     |
| lotuswordpro       | legacy word processor format reader     |
| writerperfect      | legacy document recovery layer          |
| basctl             | macro development environment           |
| dbaccess           | database front-end shell                |

### Hotspot Areas

#### Writer Internals (sw)

- `sw/inc/` -- node types, frame types, undo IDs, hint IDs, field types
- `sw/source/core/doc/` -- document model operations, bookmark, field handling
- `sw/source/core/layout/` -- page/frame layout engine, column balancing
- `sw/source/core/crsr/` -- cursor movement, selection logic
- `sw/source/core/fields/` -- dynamic field evaluation
- `sw/source/core/edit/` -- editing operations, auto-correct
- `sw/source/filter/` -- import/export (DOC, DOCX, RTF, HTML)
- `sw/source/uibase/` -- Writer UI layer (dialogs, sidebar, rulers)

#### Calc Internals (sc)

- `sc/inc/` -- cell types, formula errors, global enums, pivot enums
- `sc/source/core/data/` -- cell storage, document model, sheet operations
- `sc/source/core/tool/` -- formula compiler, interpreter, address parsing
- `sc/source/core/opencl/` -- GPU-accelerated formula computation
- `sc/source/filter/` -- Excel BIFF, XLSX, ODS, CSV filters
- `sc/source/ui/` -- Calc UI layer (cell editing, sidebar, dialogs)

#### Impress / Draw Internals (sd)

- `sd/inc/` -- slide transitions, animation effects, factory IDs
- `sd/source/core/` -- drawing document model, page management
- `sd/source/ui/` -- Impress UI layer (slide sorter, presenter console)
- `sd/source/filter/` -- PPT/PPTX import/export
- `slideshow/source/engine/` -- slide transition / animation execution engine

#### Formula Engine (formula)

- `include/formula/opcode.hxx` -- formula function opcodes (ocSum, ocIf, etc.)
- `include/formula/errorcodes.hxx` -- formula error values (errNoValue, errIllegalArgument, etc.)
- `include/formula/grammar.hxx` -- formula grammar/syntax variants
- `formula/source/core/` -- shared formula compiler/token infrastructure

#### VCL -- Visual Class Library

- `include/vcl/keycodes.hxx` -- keyboard key codes and modifier masks
- `include/vcl/event.hxx` -- input event types
- `include/vcl/outdev.hxx` -- output device (rendering surface) abstraction
- `include/vcl/font.hxx` -- font properties and enumeration
- `include/vcl/graphicfilter.hxx` -- image format detection and conversion
- `include/vcl/print.hxx` -- printer abstraction and job control
- `include/vcl/EnumContext.hxx` -- sidebar context enumeration
- `vcl/source/gdi/` -- GDI drawing operations, clipping, region logic
- `vcl/source/filter/` -- graphic format decoders (PNG, JPEG, SVG, EMF, WMF)
- `vcl/source/font/` -- font matching, substitution, metric calculation
- `vcl/source/printer/` -- platform print backend, PDF export

#### SVX -- Drawing Objects and Shared UI

- `include/svx/svdobj.hxx` -- drawing object base (SdrObject) and types
- `include/svx/xdef.hxx` -- attribute definition IDs for fills, lines, text
- `include/svx/svxids.hrc` -- slot/command IDs for shared UI actions
- `include/svx/xfillit0.hxx` -- fill style types (none, solid, gradient, bitmap, hatch)
- `svx/source/svdraw/` -- drawing object implementations
- `svx/source/sdr/` -- SDR model/view/properties framework

#### SFX2 -- Application Framework

- `include/sfx2/objsh.hxx` -- document shell (SfxObjectShell) states and flags
- `include/sfx2/event.hxx` -- document event IDs
- `include/sfx2/sfxsids.hrc` -- global slot/command IDs
- `include/sfx2/docfilt.hxx` -- document filter metadata
- `sfx2/source/doc/` -- document loading, saving, recovery, locking
- `sfx2/source/view/` -- view shell management

#### EditEng -- Rich Text Engine

- `include/editeng/` -- paragraph/character attribute items (boxitem, brushitem, colritem, etc.)
- `editeng/source/editeng/` -- core rich text editing engine
- `editeng/source/items/` -- attribute item implementations
- `editeng/source/outliner/` -- outliner (hierarchical text) engine

#### OOX -- OOXML Import/Export

- `include/oox/token/` -- XML token/namespace maps
- `include/oox/drawingml/` -- DrawingML shape/color/theme handling
- `include/oox/core/` -- OOXML fragment/context handler framework
- `oox/source/drawingml/` -- DrawingML import (shapes, charts, themes)
- `oox/source/ppt/` -- PPTX import/export
- `oox/source/export/` -- OOXML export (docx/xlsx/pptx writing)
- `oox/source/vml/` -- VML shape import

#### XMLOFF -- ODF Import/Export

- `xmloff/source/text/` -- ODF text (Writer) import/export handlers
- `xmloff/source/table/` -- ODF table import/export
- `xmloff/source/draw/` -- ODF drawing object serialization
- `xmloff/source/style/` -- ODF style import/export
- `xmloff/source/chart/` -- ODF chart serialization
- `xmloff/source/token/` -- ODF XML token tables

#### Chart2

- `chart2/source/model/` -- chart data model, series, axes
- `chart2/source/controller/` -- chart editing controller
- `chart2/source/view/` -- chart rendering pipeline
- `chart2/source/tools/` -- chart helper utilities

#### Connectivity -- Database (SDBC)

- `include/connectivity/` -- database exception types, metadata helpers
- `connectivity/source/drivers/` -- JDBC, ODBC, MySQL, PostgreSQL drivers
- `connectivity/source/parse/` -- SQL parsing engine
- `connectivity/source/cpool/` -- connection pooling

#### Filter -- Import/Export Codecs

- `filter/source/msfilter/` -- legacy MS Office binary format utilities
- `filter/source/graphic/` -- graphic format import/export wrappers
- `filter/source/pdf/` -- PDF import
- `filter/source/svg/` -- SVG import/export
- `filter/source/xslt/` -- XSLT-based transformations

#### StarBasic -- Macro Engine

- `basic/source/runtime/` -- Basic runtime interpreter
- `basic/source/comp/` -- Basic compiler
- `basic/source/sbx/` -- SBX (StarBasic eXtensions) type system
- `basic/source/classes/` -- Basic object model
- `basctl/source/` -- IDE dialogs, debugger, object browser

#### Security

- `xmlsecurity/source/xmlsec/` -- XML digital signature implementation
- `xmlsecurity/source/dialogs/` -- certificate / signature UI
- `xmlsecurity/source/helper/` -- signature helper utilities
- `xmlsecurity/source/gpg/` -- GPG-based document signing

#### Desktop / Startup

- `desktop/source/app/` -- application bootstrap, crash recovery
- `desktop/source/splash/` -- splash screen rendering
- `desktop/source/deployment/` -- extension (add-on) installation and registry
- `desktop/source/lib/` -- LibreOfficeKit (LOK) API for embedding

#### Framework / Dispatch

- `framework/source/dispatch/` -- command dispatch pipeline
- `framework/source/layoutmanager/` -- menu/toolbar/statusbar layout
- `framework/source/services/` -- UNO framework service implementations
- `framework/source/uielement/` -- toolbar, menubar, statusbar element factories

#### Shared Utility Libraries

- `include/tools/` -- error codes, color type, date/time, fixed-point math
- `include/svl/` -- number formatters, item pools, broadcast infrastructure
- `include/comphelper/` -- sequence conversion, property helpers, threading
- `include/o3tl/` -- template utilities (enumarray, typed_flags, cow_wrapper)
- `sal/inc/` -- SAL error codes, OS abstraction primitives
- `bridges/source/cpp_uno/` -- C++ UNO binary bridge (vtable mapping)

#### Common UI Dialogs (cui)

- `cui/source/options/` -- Tools > Options dialog pages
- `cui/source/tabpages/` -- formatting tab pages (character, paragraph, page)
- `cui/source/dialogs/` -- common dialogs (spell check, color picker, hyperlink)
- `cui/source/customize/` -- menu/toolbar/keyboard customization
