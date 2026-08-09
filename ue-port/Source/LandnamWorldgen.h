// World generation — a port of src/sim/worldgen.ts.
//
// The party always makes landfall on a western shore with unknown country to the
// east, so "inland" always means "into the dark". West is open sea, land firms up
// eastward, and the north and south edges fall away so the map reads as a coast
// rather than a rectangle clipped by the viewport.
//
// This is the whole reason the RNG and noise ports had to be bit-exact: a seed
// that builds an island in the browser builds the same island here, hex for hex.
//
// Ported from: src/sim/worldgen.ts

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "LandnamHex.h"
#include "LandnamRng.h"
#include "LandnamWorldgen.generated.h"

/** One generated hex. Terrain is the DataTable row name, so it feeds Get Data Table Row directly. */
USTRUCT(BlueprintType)
struct FWorldTile
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	FHex Hex;

	/** "ocean", "shore", "meadow", "forest", "hills", "mountains", "bog" or "valley". */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	FName Terrain;

	/** Fresh water inland, and effort to cross. Rivers run downhill to the sea. */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	bool bRiver = false;
};

/** A generated world. Tiles are row-major in offset space — row 0 first, west to east. */
USTRUCT(BlueprintType)
struct FLandnamWorld
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	int32 Width = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	int32 Height = 0;

	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	TArray<FWorldTile> Tiles;

	/** The westernmost shore hex near mid-map — where the keel touches sand. */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	FHex Landing;

	/** False only if 24 attempts all failed to produce a viable landmass. */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	bool bValid = false;

	/** How many attempts were needed. 1 almost always; useful when tuning the thresholds. */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Worldgen")
	int32 Attempts = 0;
};

/**
 * The generator. One call replaces the flat random terrain draw from Step 10 of
 * GETTING_STARTED with the real thing: an island, its coast, and its rivers.
 */
UCLASS()
class ULandnamWorldgen : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** 52 x 36 — the dimensions the game is balanced around. See worldgen.ts for why. */
	static constexpr int32 WorldWidth = 52;
	static constexpr int32 WorldHeight = 36;

	/** Below this elevation is sea. The single most load-bearing constant here. */
	static constexpr double SeaLevel = 0.5;

	/** Minimum contiguous land hexes reachable from the landing, else reroll. */
	static constexpr int32 MinLandmass = 400;

	/** How many rerolls before giving up, matching the TS. */
	static constexpr int32 MaxAttempts = 24;

	/**
	 * Generate from a run seed. Builds the `worldgen` stream internally, so this is
	 * the same call the browser makes at the start of a run.
	 */
	UFUNCTION(BlueprintCallable, Category = "Landnam|Worldgen", meta = (AdvancedDisplay = "Width,Height"))
	static FLandnamWorld GenerateWorld(const FString& Seed, int32 Width = 52, int32 Height = 36);

	/** Generate from an existing stream — use this if you already hold the worldgen Rng. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|Worldgen", meta = (AdvancedDisplay = "Width,Height"))
	static FLandnamWorld GenerateWorldFromRng(ULandnamRng* Rng, int32 Width = 52, int32 Height = 36);

	/** Terrain of a single hex, or None if it lies outside the map. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Worldgen")
	static FName TerrainAt(const FLandnamWorld& World, const FHex& Hex);

	/** Cheap index into World.Tiles, or -1 when outside. Offset space is a plain rectangle. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Worldgen")
	static int32 TileIndexOf(const FLandnamWorld& World, const FHex& Hex);
};
