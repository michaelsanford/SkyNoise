# Privacy Policy - SkyNoise Tracker

**Last Updated:** July 2026

## 1. Generic Statement: We Store Nothing
The SkyNoise Tracker application is designed to be entirely client-side and serverless. **We do not collect, store, share, compile, or transmit any of your personal data, logs, identifiers, cookies, or location coordinates.** All data processing occurs locally in your device's web browser, and any preferences you configure are stored solely on your machine.

---

## 2. Regulatory Compliance

### Loi 25 (Quebec, Canada)
Under Quebec's Act respecting the protection of personal information in the private sector (Loi 25), SkyNoise is compliant by design:
*   **No Collection:** Your precise geolocation coordinates (from your GPS sensor) are read directly in the browser and are never transmitted to our servers (we do not operate any backend server).
*   **Local Storage Control:** You have full authority to delete your configuration settings and search history at any time using the "Clear Log" button in the app or by clearing your browser cache.

### PIPEDA (Canada)
In accordance with Canada's Personal Information Protection and Electronic Documents Act (PIPEDA):
*   **Consent:** GPS coordinate access is only requested upon your explicit action when clicking "Use My GPS Location" or toggling the GPS switch. You can revoke this access at any time via your browser settings.
*   **Limiting Use:** Your location data is solely used in real-time to compute the distance and relative bearing to local flights for noise tracking purposes and is discarded immediately after each poll.

### GDPR (European Union)
Pursuant to the General Data Protection Regulation (GDPR):
*   **Privacy by Design & Default:** The app is configured to poll nothing and collect nothing by default.
*   **No Central Processing:** No data is sent to a central repository. Coordinates are processed locally and only used to query the open-source, public flight feed at `https://api.airplanes.live`.
*   **Right to Erasure (Right to be Forgotten):** Because all history and setting logs reside in your browser's local storage (`localStorage`), you can erase all data instantaneously by clicking "Clear Log" or clearing site data in your browser.

---

## 3. External API Queries
To show you aircraft in real-time, your browser makes direct HTTPS requests to the public, open-source endpoint hosted by:
*   **Airplanes.live** (`https://api.airplanes.live`)

These queries send the coordinates of the center point (latitude/longitude) and a detection radius (in nautical miles) so the API can filter the surrounding airspace telemetry. These requests are governed by the privacy and data policies of Airplanes.live. No identifying tokens or personal profiles are attached to these network queries.
