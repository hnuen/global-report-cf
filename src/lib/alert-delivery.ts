/** Persist monitor cooldowns only for alerts confirmed delivered by a notifier. */
export async function applySuccessfulDeliveryCooldowns(
  deliveredAlertKeys: string[],
  cooldownMinutes: number,
  markAlerted: (key: string, cooldownMinutes: number) => Promise<void>,
): Promise<void> {
  for (const key of deliveredAlertKeys) {
    await markAlerted(key, cooldownMinutes);
  }
}

