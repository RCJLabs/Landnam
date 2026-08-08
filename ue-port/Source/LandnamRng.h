// Seeded deterministic randomness — a port of src/rng.ts.
//
// FMath::Rand and friends are banned here for the same reason Math.random is
// banned in the TS: the same seed must always produce the same world, events and
// battles. The generator below is bit-for-bit identical to the browser's, so a
// seed shared between the two builds the same saga in both.
//
// Ported from: src/rng.ts

#pragma once

#include "CoreMinimal.h"
#include "UObject/Object.h"
#include "LandnamRng.generated.h"

/**
 * Named streams keep one system's rolls from shifting another's. Adding a stream
 * is always safe; renaming one silently changes every existing seed.
 */
UENUM(BlueprintType)
enum class ELandnamStream : uint8
{
	Worldgen	UMETA(DisplayName = "worldgen"),
	Party		UMETA(DisplayName = "party"),
	Events		UMETA(DisplayName = "events"),
	Combat		UMETA(DisplayName = "combat"),
	Colony		UMETA(DisplayName = "colony"),
	Saga		UMETA(DisplayName = "saga")
};

/**
 * A mulberry32 generator seeded by an FNV-1a hash of a string, matching the TS
 * `makeRng()`. Hold one per stream; call Derive for a sub-stream (per turn, per hex)
 * rather than sharing one generator across systems.
 */
UCLASS(BlueprintType)
class ULandnamRng : public UObject
{
	GENERATED_BODY()

public:
	/** A generator for an arbitrary seed string — the TS `makeRng(seed)`. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG", meta = (DisplayName = "Make RNG"))
	static ULandnamRng* MakeRng(const FString& Seed);

	/** The canonical stream for a run — the TS `stream(seed, name)`. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	static ULandnamRng* MakeStream(const FString& Seed, ELandnamStream Stream);

	/** FNV-1a over UTF-16 code units, matching the TS `hashString()`. */
	UFUNCTION(BlueprintPure, Category = "Landnam|RNG")
	static int64 HashString(const FString& Text);

	/** Human-sayable seed, e.g. "raven-skerry-317". Caller supplies the entropy. */
	UFUNCTION(BlueprintPure, Category = "Landnam|RNG")
	static FString MakeSeedPhrase(int64 Entropy);

	/** The lowercase stream name the seed is salted with — must match the TS exactly. */
	static FString StreamName(ELandnamStream Stream);

	// ---- Drawing ----

	/**
	 * Float in [0, 1). Every other draw is built on this one.
	 * Returns double, not float: JS numbers are doubles, and narrowing here would
	 * cost half the mantissa and break parity in the seventh digit.
	 */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG", meta = (DisplayName = "Next"))
	double NextDouble();

	/** Integer in [Min, Max], both inclusive. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG", meta = (DisplayName = "Next Int In Range"))
	int32 IntRange(int32 Min, int32 Max);

	/** Float in [Min, Max). Double throughout, for the reason NextDouble gives. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG", meta = (DisplayName = "Next Float In Range"))
	double FloatRange(double Min, double Max);

	/** True with probability P. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	bool Chance(double P);

	/** Sum of Count dice with Sides faces, e.g. Roll(2, 6). */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	int32 Roll(int32 Count, int32 Sides);

	/**
	 * A random index into an array of Num entries — the TS `pick()`. Blueprint has no
	 * generics, so index-based is the portable shape: Array[PickIndex(Array.Num())].
	 * Returns -1 for an empty array (the TS throws).
	 */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	int32 PickIndex(int32 Num);

	/**
	 * The indices 0..Num-1 in shuffled order — the TS `shuffle()`. Draws in the same
	 * sequence as the original in-place Fisher-Yates, so streams stay aligned.
	 */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	TArray<int32> ShuffleIndices(int32 Num);

	/** An index chosen in proportion to Weights — the TS `weighted()`. Negatives count as 0. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	int32 WeightedIndex(const TArray<double>& Weights);

	/** A derived independent stream, e.g. per-turn or per-hex — the TS `derive()`. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|RNG")
	ULandnamRng* Derive(const FString& Label);

	/** The seed string this generator was built from, for saves and debug display. */
	UFUNCTION(BlueprintPure, Category = "Landnam|RNG")
	const FString& GetSeed() const { return Seed; }

private:
	void Init(const FString& InSeed);

	UPROPERTY()
	FString Seed;

	/** mulberry32 state. Wraps as uint32, exactly as the TS `| 0` and `imul` do. */
	uint32 State = 0;
};
