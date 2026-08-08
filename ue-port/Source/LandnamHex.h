// Axial hex coordinates, pointy-top orientation — a port of src/hex/ from the
// TypeScript game. Kept behaviourally identical to the original so the same seed
// builds the same map in Unreal as in the browser; LandnamParityTest.cpp proves it.
//
// Ported from: src/hex/coords.ts, src/hex/grid.ts, src/hex/path.ts
// Reference: redblobgames.com/grids/hexagons

#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "Templates/Function.h"
#include "LandnamHex.generated.h"

/**
 * A hex on the axial grid. q grows east, r grows south-east.
 * The TS side is `{ q, r }` — same two integers, same meaning.
 */
USTRUCT(BlueprintType)
struct FHex
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Landnam|Hex")
	int32 Q = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Landnam|Hex")
	int32 R = 0;

	FHex() = default;
	FHex(int32 InQ, int32 InR) : Q(InQ), R(InR) {}

	/** The implied cube coordinate: Q + R + S == 0 always. */
	int32 S() const { return -Q - R; }

	/** Stable "q,r" string, matching the TS `key()` — used by saves and debug output. */
	FString ToKey() const { return FString::Printf(TEXT("%d,%d"), Q, R); }

	/** Inverse of ToKey. Malformed input yields (0,0), as `Number('')` would yield NaN->0 here. */
	static FHex FromKey(const FString& Key);

	bool operator==(const FHex& Other) const { return Q == Other.Q && R == Other.R; }
	bool operator!=(const FHex& Other) const { return !(*this == Other); }
};

/** Lets FHex be a TMap/TSet key, which is what replaces the TS string-keyed maps. */
FORCEINLINE uint32 GetTypeHash(const FHex& Hex)
{
	return HashCombine(::GetTypeHash(Hex.Q), ::GetTypeHash(Hex.R));
}

/**
 * Tells the reflection system that == is the whole story for FHex. Without this,
 * Blueprint refuses to use it as a Map key, which is exactly how a grid wants to
 * store its tiles.
 */
template<>
struct TStructOpsTypeTraits<FHex> : public TStructOpsTypeTraitsBase2<FHex>
{
	enum { WithIdenticalViaEquality = true };
};

namespace LandnamHex
{
	/** A cost at or above this is impassable — the C++ stand-in for the TS `Infinity`. */
	static constexpr double Impassable = TNumericLimits<double>::Max();

	FORCEINLINE bool IsPassable(double Cost) { return Cost < Impassable; }
}

/**
 * Cost to ENTER a hex. Return a negative value for impassable — Blueprint has no
 * clean way to express the TS `Infinity`, so negative is the sentinel. C++ callers
 * may also return INFINITY; both are treated as impassable.
 */
DECLARE_DYNAMIC_DELEGATE_RetVal_OneParam(float, FHexCostDelegate, FHex, Hex);

/** A path from start to goal. Hexes is empty and Cost is negative when unreachable. */
USTRUCT(BlueprintType)
struct FHexPath
{
	GENERATED_BODY()

	/** Start-to-goal inclusive; empty when unreachable. */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Hex")
	TArray<FHex> Hexes;

	/** Total movement cost, or -1 when unreachable (the TS returns Infinity). */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Hex")
	float Cost = -1.0f;

	/** Convenience for Blueprint branching, so nobody has to remember the -1. */
	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Hex")
	bool bReachable = false;
};

/** One hex and what it cost to reach — the array form of the TS `reachable()` map. */
USTRUCT(BlueprintType)
struct FHexReach
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Hex")
	FHex Hex;

	UPROPERTY(BlueprintReadOnly, Category = "Landnam|Hex")
	float Cost = 0.0f;
};

/**
 * The shared hex library. Used by BOTH the world map and the battle grid —
 * never reimplement hex math inline, exactly as the TS project rules require.
 */
UCLASS()
class UHexLib : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	// ---- Construction and identity (src/hex/coords.ts) ----

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex", meta = (DisplayName = "Make Hex"))
	static FHex MakeHex(int32 Q, int32 R) { return FHex(Q, R); }

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FString HexToKey(const FHex& Hex) { return Hex.ToKey(); }

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexFromKey(const FString& Key) { return FHex::FromKey(Key); }

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static bool HexEquals(const FHex& A, const FHex& B) { return A == B; }

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexAdd(const FHex& A, const FHex& B) { return FHex(A.Q + B.Q, A.R + B.R); }

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexSubtract(const FHex& A, const FHex& B) { return FHex(A.Q - B.Q, A.R - B.R); }

	/**
	 * Round fractional axial coordinates to the nearest hex.
	 * Takes doubles, not floats — JS numbers are doubles, and narrowing here would
	 * tip cases that sit exactly on a rounding boundary into the wrong hex.
	 */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexRound(double Qf, double Rf);

	// ---- Space conversion (src/hex/coords.ts) ----

	/**
	 * Flat 2D centre of a hex, matching the TS `toPixel()` exactly: x grows east,
	 * y grows south. Size is the centre-to-corner radius. Use this for parity
	 * checks and 2D work; use HexToWorld to place actors in a level.
	 */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FVector2D HexToPixel(const FHex& Hex, double Size);

	/** Inverse of HexToPixel: which hex contains this 2D point. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexFromPixel(double X, double Y, double Size);

	/**
	 * World-space centre for spawning actors. Unreal is X-north / Y-east / Z-up
	 * while the TS pixel space is x-east / y-south, so this maps
	 * (px, py) -> (-py, px) and a top-down camera sees the browser's layout.
	 */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FVector HexToWorld(const FHex& Hex, double Size, double Z = 0.0);

	/** Inverse of HexToWorld — turns a click position into a hex. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexFromWorld(const FVector& Location, double Size);

	/** The six corner points of a hex centred at (CX, CY), for drawing outlines. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static TArray<FVector2D> HexCorners(double CX, double CY, double Size);

	// ---- Offset-space conversion (src/hex/coords.ts) ----

	/** Rectangular maps are authored in odd-r offset space, then stored as axial. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex OffsetToAxial(int32 Col, int32 Row);

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static void AxialToOffset(const FHex& Hex, int32& Col, int32& Row);

	/** Column index in offset space — used for east/west reasoning on the map. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static int32 HexColumn(const FHex& Hex);

	// ---- Neighbourhood and shape (src/hex/grid.ts) ----

	/** The six unit directions, ordered so (Dir + 3) % 6 is the opposite. 0 = east. */
	static const TArray<FHex>& Directions();

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static FHex HexNeighbor(const FHex& Hex, int32 Direction);

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static TArray<FHex> HexNeighbors(const FHex& Hex);

	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static int32 HexDistance(const FHex& A, const FHex& B);

	/** Direction index from A toward adjacent B, or -1 if they are not adjacent. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static int32 HexDirectionTo(const FHex& A, const FHex& B);

	/** Every hex exactly Radius steps from Center. Radius 0 yields [Center]. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static TArray<FHex> HexRing(const FHex& Center, int32 Radius);

	/** Every hex within Radius steps of Center, inclusive — the grid spawner's workhorse. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static TArray<FHex> HexRange(const FHex& Center, int32 Radius);

	/** Hexes along the straight line from A to B, both endpoints included. */
	UFUNCTION(BlueprintPure, Category = "Landnam|Hex")
	static TArray<FHex> HexLine(const FHex& A, const FHex& B);

	// ---- Pathfinding (src/hex/path.ts) ----

	/** A* from Start to Goal. Cost returns the price of ENTERING a hex; negative = impassable. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|Hex")
	static FHexPath FindPath(const FHex& Start, const FHex& Goal, const FHexCostDelegate& Cost);

	/** Every hex reachable within Budget, with its cheapest cost — movement range. */
	UFUNCTION(BlueprintCallable, Category = "Landnam|Hex")
	static TArray<FHexReach> Reachable(const FHex& Start, float Budget, const FHexCostDelegate& Cost);

	// C++-side entry points: take any callable and skip the delegate boxing. Named
	// apart from the Blueprint versions rather than overloaded, because UnrealHeaderTool
	// is easier to work with when a UFUNCTION name means exactly one thing.
	static FHexPath FindPathNative(const FHex& Start, const FHex& Goal, TFunctionRef<double(const FHex&)> Cost);
	static TMap<FHex, double> ReachableNative(const FHex& Start, double Budget, TFunctionRef<double(const FHex&)> Cost);
};
