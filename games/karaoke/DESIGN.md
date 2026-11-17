# Karaoke Club

**Pitch:** Everyone grabs a mic and sings the same song together in a neon club. The lyrics scroll Spotify-style, your chibi opens its mouth and bounces as you sing, and the club lights up from the party's voices.

## Players
1–8. Everyone is on stage at once, with spots in sorted peer-id order. It works solo.

## Round
1. The **host** (smallest peer id) pastes a YouTube link.
   - The game reads the video title (oEmbed) and searches LRCLIB for synced lyrics.
   - It auto-picks the result whose duration is closest to the video's, and the host can change the pick.
   - Everyone else sees "Host is picking a song…".
2. **Start:** the host sends `song`. Everyone cues the video, fetches the lyrics, and starts playing 3 s later.
3. **Sing:** the active lyric line sweeps from left to right. Each line is worth up to 100 points, based on how much of the line you were voicing (with a pitch detected). Being voiced for 60% of the line gives full marks.
4. **End:** when the video ends there's a results card (ranking, and confetti for the winner). The host picks the next song, or anyone can go back to the hub.

## Controls
- **Mic:** the "🎤 Mic" button toggles it, and headphones are recommended.
- **Host:** link box, lyrics search, Start, Stop, and lyric offset ±0.5 s.
- Back to hub.
- Touch: the same buttons, which are big enough to tap. There is no movement.

## Network (party room `karaoke-<code>`)
| event | from | data |
|---|---|---|
| `song` | host | `{vid, id, offset, title}`: the YouTube id, LRCLIB id, lyric offset in seconds, and the song title. Everyone starts playing 3 s after receiving it |
| `clock` | host, every 2 s | `{t, playing}`: the host's video time. A player more than 0.6 s off seeks |
| `offset` | host | number: the lyric offset |
| `stop` | host | `{}`: end the song and show results |
| `sing` | everyone, 10/s | `{v, h, s}`: volume 0–1, pitch hue 0–1 or -1, and score |

Every event is validated (`logic.js`). When the host leaves, the next smallest id takes over, since everyone already knows the song. A player who joins late gets `song` and `clock` from the host.

## Feel
- The lyrics are big and bold, the active line is bright, and past lines fade.
- Your mouth opens with your volume, you bounce harder the louder you sing, and you raise your arms on long held notes.
- Each pitch class has its own colour, used for your spotlight, floor tiles and equalizer bar.
- New lyric lines make the lasers swing and the speakers pump.
- The disco ball spins faster as the whole party gets louder.

## Assets
All procedural, with no files: the club, LED floor, disco ball, lasers, speakers, and a neon sign drawn on a canvas. Music comes from YouTube embeds. Lyrics are fetched from LRCLIB at runtime.

## Cut
- Hearing each other's voices.
- Melody-accurate scoring (we have no notes).
- A YouTube search box (needs an API key).
- Duets and queues.
- Bloom.
