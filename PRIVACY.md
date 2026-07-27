# Privacy Policy — SkyNoise Tracker

**Last Updated:** July 2026

## 1. What this app does and does not do

SkyNoise is entirely client-side. There is no backend, no account, no cookie, no
analytics and no telemetry. **We operate no servers and collect nothing about you.**
Your coordinates, settings and overhead-flight log exist only in your own browser's
`localStorage`.

**One thing does leave your device.** To find aircraft near you, your browser sends
your latitude, longitude and search radius directly to
[`api.airplanes.live`](https://airplanes.live) — a third-party public flight feed —
once per poll interval, for as long as tracking is running. No identifier, token or
profile accompanies those requests, but that service does receive your approximate
location. This is unavoidable for the app to function: the query *is* "what is flying
near this point".

If that trade is not acceptable to you, do not enter a location. The app transmits
nothing until you provide one.

### Data controller

Michael Sanford — <michaelsanford@users.noreply.github.com>.
Questions or concerns: <https://github.com/michaelsanford/SkyNoise/issues>.

---

## 2. Regulatory position

### Loi 25 (Quebec, Canada)

- **Consent is explicit and revocable.** Geolocation is requested only when you press
  "Use My GPS Location" or enable the GPS switch, and your browser can revoke it at any
  time.
- **No collection by us.** Coordinates are read in the browser and used to compute
  distance and bearing locally. We receive nothing, because no server of ours exists to
  receive it.
- **Third-party disclosure.** Section 1 and section 3 name the one external recipient.

### PIPEDA (Canada)

- **Limited use.** Your location is used only to compute distance, bearing and closest
  approach for nearby flights, and to scope the API query to your area. No profile is
  built.
- **Retention.** Your coordinates *are* retained locally, in `localStorage`, so the app
  remembers your location between sessions. They are not retained by us, and API
  responses are not persisted beyond the current radar view and the overhead log.

### GDPR (European Union)

- **Privacy by default.** With no location configured, the app polls nothing and
  transmits nothing.
- **Local processing.** All distance, noise and trajectory computation happens on your
  device.
- **Right to erasure (Art. 17).** Settings → Privacy → **"Erase all local data"** removes
  your saved location, every setting and the entire overhead log, returning the app to
  first-run state.

  Note that **"Clear Log"** on the history tab is deliberately narrower: it erases the
  log only and leaves your location configured. Use "Erase all local data" for full
  erasure. Clearing site data in your browser has the same effect.

---

## 3. External requests

Your browser makes direct HTTPS requests to exactly one external origin:

| Origin | Purpose | What it receives |
|---|---|---|
| `https://api.airplanes.live` | Nearby aircraft telemetry | Latitude, longitude, radius in nautical miles |

These requests are governed by Airplanes.live's own policies. The app's
Content-Security-Policy restricts network access to this origin plus `'self'`, so the
page cannot silently begin contacting anything else. Web fonts are self-hosted
specifically so that loading the page contacts no third party at all.

---

## 4. What is stored on your device

| Key | Contents |
|---|---|
| `skynoise_settings` | Coordinates, airport code, thresholds, poll interval, radar orientation |
| `skynoise_history` | Up to 100 overhead passes: callsign, type, registration, time, closest distance, altitude |

Nothing else is written, and neither key ever leaves your browser.
