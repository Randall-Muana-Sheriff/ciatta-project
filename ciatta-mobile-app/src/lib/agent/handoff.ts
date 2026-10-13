// Which referral the referral screen opens on, or the specialty a new one
// starts with. Navigation carries a screen name only.
let referral: { id: string | null; specialty: string | null } = { id: null, specialty: null };

export const chooseReferral = (id: string | null, specialty: string | null = null) => {
  referral = { id, specialty };
};

export const takeReferral = () => {
  const r = referral;
  referral = { id: null, specialty: null };
  return r;
};
