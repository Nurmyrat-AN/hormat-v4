# TranslatableField — approved inline translation UX

A base/default input with a globe/count end-adornment expands its own translation editor directly below. Every active language is visible simultaneously. Use this as the default for applicable Brand/Category/Product/content text fields; another UX needs a concrete module-specific reason. This document does not authorize another module or persistence schema.

## Integration

- Render `partials/content/translatable-field.ejs` with unique `fieldId`, localized `fieldLabel` and `lockedLabel`, and the active `languages` registry supplied by existing localization middleware.
- Load `translatable-field.css` and import `TranslatableField` from the content browser module.
- Create one instance per field, passing `onChange` and `onSave` callbacks. Each instance has its own `DraftState`, DOM scope and expansion. Multiple fields can be open simultaneously.
- `reset(overrides)` initializes the saved baseline/draft and empties absent inputs. Call when selecting a different entity, not when collapsing or switching tabs.
- `render({base,baseDirty,locked,editable,busy})` updates accessible state, completeness, missing markers, fallback text and controls without rewriting input values/focus. `baseDirty` refers to this base field, not unrelated form edits.
- `state.save(adapter)` is independent of base/other fields. The caller supplies persistence and refreshes the component around the asynchronous operation. Brands now supplies a real transactional translation endpoint and accepts its normalized saved baseline only on success.

## Contract

Only explicit nonblank active-language values count as complete. Missing fallback is not a translation. Empty rows show a neutral missing state and the current base input; an unsaved base is explicitly labeled as preview. No automatic base copying occurs.

The toggle is a real button with a field-specific translated label/title and aria-expanded/aria-controls. Enter/Space operates it. Collapsing preserves drafts and dirty status; the compact dirty marker stays visible. Enter inside a translation input cannot accidentally submit the enclosing Basic form.

Save Translations belongs to that field. It does not save/clear Basic Information or Gallery. Errors preserve dirty state and permit retry. Dialog/page exit checks include collapsed field drafts. Opening another field does not close this one.

At Create, the control is visible but disabled until entity identity exists. A count of zero still refers to active registry languages. After same-dialog Create → Edit it unlocks; view-only users can expand/read, while edit controls follow `brands.update` in the current consumer.

The component does not own a backend or language registry. Interface strings come from PostgreSQL through `t()`; Brands content overrides use the separate brand_translations table described in [Brands contract](CPANEL_BRANDS.md). Other consumers supply their own approved persistence adapter. Brands supplies a localized durable-save message; preview consumers may retain their preview-specific message.
