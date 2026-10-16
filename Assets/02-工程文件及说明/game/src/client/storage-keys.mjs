// Preserve the accepted V15 machine and dispenser state on the same browser origin.
// Renaming these keys is a data migration, not a cosmetic version change.
export const STORAGE_KEYS = Object.freeze({
  machine: 'bubble-integrated-v15-machine',
  device: 'bubble-integrated-v15-device',
});
