"use client";

import { useEffect, useState } from "react";
import { isPlatformAuthenticatorAvailable } from "./webauthn";

/** Whether this device/browser has a usable platform biometric authenticator. */
export function useBiometricAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isPlatformAuthenticatorAvailable().then((result) => {
      if (!cancelled) setAvailable(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}
