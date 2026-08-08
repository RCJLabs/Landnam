// Row structs for the content tables exported by ue-port/tools/export-data.mjs.
//
// Each USTRUCT here matches the field names in one of the JSON files, which is what
// lets Unreal import them as DataTables. Content stays plain data on both sides:
// adding terrain or a foe means editing src/data/*.ts and re-running the exporter,
// never touching engine code.

#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "LandnamDataRows.generated.h"

/** One terrain type — matches Content/Data/terrain.json (from src/data/terrain.ts). */
USTRUCT(BlueprintType)
struct FTerrainRow : public FTableRowBase
{
	GENERATED_BODY()

	/** Stable id, e.g. "meadow". Also the DataTable row name. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	FName Id;

	/** What the player is shown, e.g. "Open Sea". */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	FString DisplayName;

	/**
	 * Effort to enter. -1 means impassable on foot — the TS uses Infinity, which JSON
	 * cannot carry, and -1 is already the impassable sentinel for FHexCostDelegate.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	double Cost = 1.0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	int32 Forage = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	int32 Hunt = 0;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	int32 Fish = 0;

	/** Firewood gathered per camp night. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	int32 Wood = 0;

	/** Blocks sight beyond it — hills, mountains, dense forest. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	bool bBlocksSight = false;

	/** False for open sea. Land is what can be settled and walked. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	bool bIsLand = true;

	/** Base fill colour as "#rrggbb", the same palette the SVG renderer paints with. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	FString Fill;

	/** Darker edge colour as "#rrggbb". */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Terrain")
	FString Edge;
};

/** One enemy archetype — matches Content/Data/foes.json (from src/data/foes.ts). */
USTRUCT(BlueprintType)
struct FFoeArchetypeRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	FName Id;

	/** Shown instead of a trait name on the fighter card, e.g. "Huscarl". */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	FString Kind;

	/** Points spread over the four stats, on top of a base of 1 each. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	int32 Budget = 0;

	/**
	 * Leans the spread toward these stats: might, wits, spirit, craft.
	 * Repeats are meaningful — listing "wits" twice weights it twice.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	TArray<FString> Favours;

	/** Extra health beyond the might-derived base; may be negative. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	int32 Toughness = 0;

	/** aggressive, cautious, or flanker — see the FoeArchetype doc comment in the TS. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	FName Temperament;

	/** Spears and hand-axes carried into the fight. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	int32 Throws = 0;

	/** Relative odds of being rolled up — feed to ULandnamRng::WeightedIndex. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Foe")
	int32 Weight = 0;
};

UCLASS()
class ULandnamDataLib : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/**
	 * Turns a "#rrggbb" from the data tables into a colour a material can use.
	 * The hex values are sRGB, as authored for the SVG renderer, so they go through
	 * FromSRGBColor — assigning the raw bytes would come out visibly washed out.
	 */
	UFUNCTION(BlueprintPure, Category = "Landnam|Data")
	static FLinearColor ColorFromHex(const FString& Hex)
	{
		return FLinearColor::FromSRGBColor(FColor::FromHex(Hex));
	}

	/** True when this terrain cannot be entered on foot. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Data")
	static bool IsTerrainImpassable(const FTerrainRow& Terrain) { return Terrain.Cost < 0.0; }
};
