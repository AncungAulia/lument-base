"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchProfile } from "../services/profile.service";
import { EMPTY_PROFILE, type ProfileData } from "../types/profile.types";

export function useProfile(address: string | null) {
  const [profileData, setProfileData] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!address) return;
    let cancelled = false;
    try {
      setLoading(true);
      const data = await fetchProfile(address);
      if (!cancelled) setProfileData(data);
    } catch (err) {
      console.error("Failed to load profile:", err);
    } finally {
      if (!cancelled) setLoading(false);
    }
    return () => { cancelled = true; };
  }, [address]);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setLoading(true);
    fetchProfile(address)
      .then((data) => { if (!cancelled) setProfileData(data); })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [address]);

  return { profileData, loading, reload: load };
}
