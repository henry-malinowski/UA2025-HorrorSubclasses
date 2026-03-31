Hooks.once("init", () => {
	console.log("ua2025-horror-subclasses.js hooked");
});

/**
 * Check for Spirits From Beyond usage after a feature is used.
 * If it is, perform roll with the actor's roll data context and apply it to enrichers on the result.
 */
Hooks.on("dnd5e.postUseActivity", async (activity, usageConfig, results) => {
	const targetUUID =
		"Compendium.UA2025-HorrorSubclasses.classes.Item.uabrdSpiritsfrom";

	// Check if this activity belongs to the target feature by checking the original compendium source
	const originalSourceId = activity.item.flags.dnd5e?.sourceId;
	if (originalSourceId !== targetUUID) return;

	// Get the actor who owns this item
	const actor = activity.item.actor;
	if (!actor) return;

	// Execute the Spirits From Beyond macro logic after the activity has been used
	await executeSpiritsFromBeyond(actor);
});

async function executeSpiritsFromBeyond(actor) {
	try {
		const spiritsFromBeyond = await fromUuid(
			"Compendium.UA2025-HorrorSubclasses.tables.RollTable.uaSpiritsfromBey",
		);
		if (!spiritsFromBeyond) {
			console.error("Could not find Spirits From Beyond roll table");
			return;
		}

		const rollData = actor.getRollData();

		// Check if actor has 14+ bard levels for double rolls
		const rollCount = hasMysticalConnection(rollData) ? 2 : 1;

		// Perform the appropriate number of rolls
		const allResults = [];
		const allRolls = [];

		for (let i = 0; i < rollCount; i++) {
			const roll = new Roll("@scale.bard.inspiration.die", rollData);
			const draw = await spiritsFromBeyond.roll({ roll });

			// Pre-enrich result descriptions with roll data context
			for (const result of draw.results) {
				if (result.description) {
					result.description = await TextEditor.implementation.enrichHTML(
						result.description,
						{
							rollData: rollData,
							secrets: result.isOwner,
							relativeTo: result,
						},
					);
				}
			}

			allResults.push(...draw.results);
			allRolls.push(draw.roll);
		}

		// Display results - if multiple rolls, combine them
		if (rollCount === 2) {
			// For multiple rolls, create a combined roll using PoolTerm
			const pool = CONFIG.Dice.termTypes.PoolTerm.fromRolls(allRolls);
			const combinedRoll = Roll.defaultImplementation.fromTerms([pool]);
			await spiritsFromBeyond.toMessage(allResults, { roll: combinedRoll });
		} else {
			await spiritsFromBeyond.toMessage(allResults, { roll: allRolls[0] });
		}
	} catch (error) {
		console.error("Error executing Spirits From Beyond macro:", error);
	}
}

function hasMysticalConnection(rollData) {
	// The path is always classes.bard.levels exactly
	const bardLevels = rollData?.classes?.bard?.levels;
	if (bardLevels === undefined) return false;

	// It is always an integer, return the comparison result
	return bardLevels >= 14;
}
