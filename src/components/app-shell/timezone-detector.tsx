"use client";

import { useEffect } from "react";
import { updateTimezoneAction } from "@/lib/actions/auth";

interface Props {
  currentTimezone: string;
}

/**
 * Invisible client component. On first mount, detects the browser's IANA
 * timezone and silently persists it if the stored value is still the "UTC"
 * default. This ensures correct date display and day-of-week logic server-side
 * without requiring users to manually configure their timezone.
 */
export function TimezoneDetector({ currentTimezone }: Props) {
  useEffect(() => {
    if (currentTimezone !== "UTC") return;
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected && detected !== "UTC") {
        updateTimezoneAction(detected);
      }
    } catch {
      // Intl not available — leave as UTC
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
