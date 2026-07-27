/**
 * Vendor-prefixed and platform-gated DOM APIs the compass code depends on.
 *
 * These are real, shipping browser APIs that are simply absent from lib.dom.
 * Declaring them here means the call sites narrow properly instead of casting
 * through `any`, which silences every other check on the same expression.
 */

interface DeviceOrientationEvent {
  /**
   * iOS/WebKit only: true compass heading in degrees clockwise from magnetic
   * north. Absent on Chrome/Android, where `alpha` must be used instead (and
   * increases counter-clockwise, so it needs inverting).
   */
  readonly webkitCompassHeading?: number;
  /** iOS/WebKit only: heading accuracy in degrees. */
  readonly webkitCompassAccuracy?: number;
}

/**
 * iOS 13+ gates the orientation sensor behind an explicit permission call that
 * must originate from a user gesture. The constructor carries the static
 * method; it does not exist at all on other platforms, which is why callers
 * must feature-detect rather than assume.
 */
interface DeviceOrientationPermissionAPI {
  requestPermission: () => Promise<'granted' | 'denied' | 'prompt' | 'default'>;
}
