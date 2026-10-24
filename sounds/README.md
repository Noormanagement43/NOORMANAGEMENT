# NOOR AI — Sound System (Ticket 07)

## Architecture
- `sound-manager.js` is the only playback layer. App components must not create their own `Audio` objects.
- `sound-map.js` maps event names to the bundled audio sample keys and contains the sound preview categories.
- `sound-assets-01.js` through `sound-assets-05.js` bundle the CC0 OGG samples so GitHub Pages does not need third-party audio URLs.
- `sound-settings.js` renders the Sound & Feel controls into the existing Settings view.
- `sound.css` styles the controls using the existing NOOR AI theme.
- `../supabase/migrations/20261015195740_user_sound_preferences.sql` stores each authenticated user’s private settings with row-level security.

## Public API
```js
window.NOOR_SOUND.playSound("ding");
window.NOOR_SOUND.setVolume(0.24); // 0 to 0.5
window.NOOR_SOUND.mute();
window.NOOR_SOUND.unmute();
window.NOOR_SOUND.setPreferences({
  masterSound: true,
  volume: 0.32,
  voiceCheers: true,
  haptics: true
});
```

For an existing button, add `data-sound="event-name"` to select an event explicitly. Use `data-sound="none"` to skip click feedback. Navigation, generic buttons, toggles, assessment submissions, upload/download actions, AI generation, toast messages, AI note-generation status, and timer elements (`data-test-timer`, `data-countdown`, `.test-timer`, or `#testTimer`) are handled centrally.

## Change a sound
Edit `eventToAsset` in `sound-map.js`. Point the desired event at any key present in `window.NOOR_SOUND_ASSETS`. For a new file, add its CC0/commercial-use source to an asset bank (or create another bank and load it before `sound-manager.js` in `index.html`), then add the per-file source and licence to the root `CREDITS.md`.

## Formats and voice
The currently bundled pack is OGG-only; all bundled OGG payloads are under 60 KB. This commit does not include paired MP3 files or separately recorded female voice clips. Short English, Hindi, and Telugu cheers use the browser’s Speech Synthesis engine when available, with the closest matching local voice selected; the OS/browser controls which voices are actually available. If Howler/audio decoding is unavailable, a very short Web Audio tone is used as a fallback.

The current NOOR AI profile schema does not yet allow a Parent role. The sound layer itself is role-agnostic, and a Parent navigation branch is prepared, but creating/enabling Parent accounts is outside this ticket.
