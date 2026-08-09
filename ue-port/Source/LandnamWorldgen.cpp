// Ported from: src/sim/worldgen.ts

#include "LandnamWorldgen.h"

#include "LandnamNoise.h"
#include "LandnamRng.h"

namespace LandnamTerrain
{
	// Function-local statics rather than namespace-scope FNames: FName's table is not
	// guaranteed to exist during static init, and these are cheap after the first call.
	static const FName& Ocean()     { static const FName N(TEXT("ocean"));     return N; }
	static const FName& Shore()     { static const FName N(TEXT("shore"));     return N; }
	static const FName& Meadow()    { static const FName N(TEXT("meadow"));    return N; }
	static const FName& Forest()    { static const FName N(TEXT("forest"));    return N; }
	static const FName& Hills()     { static const FName N(TEXT("hills"));     return N; }
	static const FName& Mountains() { static const FName N(TEXT("mountains")); return N; }
	static const FName& Bog()       { static const FName N(TEXT("bog"));       return N; }
	static const FName& Valley()    { static const FName N(TEXT("valley"));    return N; }
}

namespace
{
	struct FField
	{
		double Elevation = 0.0;
		double Moisture = 0.0;
	};

	/** Row-major index for a hex, or -1 outside the rectangle. */
	int32 IndexOf(const FHex& Hex, int32 Width, int32 Height)
	{
		int32 Col = 0;
		int32 Row = 0;
		UHexLib::AxialToOffset(Hex, Col, Row);
		if (Col < 0 || Col >= Width || Row < 0 || Row >= Height)
		{
			return INDEX_NONE;
		}
		return Row * Width + Col;
	}

	/**
	 * Elevation and moisture for every hex.
	 *
	 * Draw order is load-bearing: the two noise fields derive their own sub-streams
	 * (consuming nothing from the parent), then the parent supplies exactly two ints
	 * for the sampling origin. Anything drawn out of turn shifts every later seed.
	 */
	TArray<FField> BuildFields(ULandnamRng* Rng, int32 Width, int32 Height)
	{
		FLandnamFbm ElevationNoise;
		ElevationNoise.Init(Rng->Derive(TEXT("elevation")), 5);

		FLandnamFbm MoistureNoise;
		MoistureNoise.Init(Rng->Derive(TEXT("moisture")), 3);

		// Jittered sampling origin so seeds do not share a corner of the noise field.
		const double Ox = Rng->IntRange(0, 900);
		const double Oy = Rng->IntRange(0, 900);

		TArray<FField> Fields;
		Fields.SetNum(Width * Height);

		for (int32 Row = 0; Row < Height; ++Row)
		{
			for (int32 Col = 0; Col < Width; ++Col)
			{
				const double Nx = Ox + Col * 0.16;
				const double Ny = Oy + Row * 0.16;

				// West is always open sea; land firms up as you go east.
				const double Eastward = static_cast<double>(Col) / (Width - 1);
				// The sea keeps a wide margin: open water is somewhere to BE, not just
				// the edge of the picture.
				const double WestBias = FMath::Min(1.0, FMath::Max(0.0, (Eastward - 0.12) / 0.35));

				// Soften the north and south edges so the land reads as a coast.
				const double EdgeY = FMath::Min(Row, Height - 1 - Row) / (Height * 0.28);
				const double NorthSouthFalloff = FMath::Min(1.0, FMath::Max(0.0, EdgeY));

				const double Raw = ElevationNoise.Sample(Nx, Ny);

				FField& Field = Fields[Row * Width + Col];
				Field.Elevation = Raw * 0.62 + WestBias * 0.52 - (1.0 - NorthSouthFalloff) * 0.38;
				Field.Moisture = MoistureNoise.Sample(Nx + 40.0, Ny + 40.0);
			}
		}
		return Fields;
	}

	const FName& Classify(double Elevation, double Moisture)
	{
		if (Elevation < ULandnamWorldgen::SeaLevel) return LandnamTerrain::Ocean();
		if (Elevation > 0.86) return LandnamTerrain::Mountains();
		if (Elevation > 0.74) return LandnamTerrain::Hills();
		if (Moisture > 0.68) return Elevation < 0.58 ? LandnamTerrain::Bog() : LandnamTerrain::Forest();
		if (Moisture > 0.44) return LandnamTerrain::Forest();
		if (Moisture > 0.3) return Elevation < 0.62 ? LandnamTerrain::Valley() : LandnamTerrain::Meadow();
		return LandnamTerrain::Meadow();
	}

	/** Land hexes touching the sea become shore — where a knarr can beach. */
	void MarkShore(TArray<FWorldTile>& Tiles, int32 Width, int32 Height)
	{
		// Safe to edit in place: ocean tiles are never rewritten, and shore is not ocean,
		// so no tile's verdict can depend on an earlier tile's change.
		for (FWorldTile& Tile : Tiles)
		{
			if (Tile.Terrain == LandnamTerrain::Ocean() || Tile.Terrain == LandnamTerrain::Mountains())
			{
				continue;
			}

			for (const FHex& Neighbor : UHexLib::HexNeighbors(Tile.Hex))
			{
				const int32 NeighborIndex = IndexOf(Neighbor, Width, Height);
				if (NeighborIndex != INDEX_NONE && Tiles[NeighborIndex].Terrain == LandnamTerrain::Ocean())
				{
					Tile.Terrain = LandnamTerrain::Shore();
					break;
				}
			}
		}
	}

	/**
	 * Rivers run downhill from high ground to the sea, marking every hex they pass
	 * through. A river may simply stop — at a lake, or a dead end — which is why the
	 * walk breaks rather than backtracking.
	 */
	void CarveRivers(ULandnamRng* Rng, TArray<FWorldTile>& Tiles, const TArray<FField>& Fields,
		int32 Count, int32 Width, int32 Height)
	{
		// Built in the same row-major order the TS object holds its keys in — PickIndex
		// selects by position, so a different order here is a different set of rivers.
		TArray<int32> Sources;
		for (int32 Index = 0; Index < Tiles.Num(); ++Index)
		{
			const FName& Terrain = Tiles[Index].Terrain;
			if (Terrain == LandnamTerrain::Mountains()
				|| (Terrain == LandnamTerrain::Hills() && Fields[Index].Elevation > 0.78))
			{
				Sources.Add(Index);
			}
		}
		if (Sources.Num() == 0)
		{
			return;
		}

		for (int32 River = 0; River < Count; ++River)
		{
			int32 Current = Sources[Rng->PickIndex(Sources.Num())];
			TSet<int32> Walked;

			for (int32 Step = 0; Step < 60; ++Step)
			{
				if (Walked.Contains(Current))
				{
					break;
				}
				Walked.Add(Current);

				FWorldTile& Tile = Tiles[Current];
				if (Tile.Terrain == LandnamTerrain::Ocean())
				{
					break;
				}
				Tile.bRiver = true;

				// Flow to the lowest neighbour not already used. Strictly lower, so the
				// first neighbour wins ties — which makes neighbour order load-bearing.
				int32 BestIndex = INDEX_NONE;
				double BestElevation = Fields[Current].Elevation;
				for (const FHex& Neighbor : UHexLib::HexNeighbors(Tile.Hex))
				{
					const int32 NeighborIndex = IndexOf(Neighbor, Width, Height);
					if (NeighborIndex == INDEX_NONE || Walked.Contains(NeighborIndex))
					{
						continue;
					}
					if (Fields[NeighborIndex].Elevation < BestElevation)
					{
						BestElevation = Fields[NeighborIndex].Elevation;
						BestIndex = NeighborIndex;
					}
				}
				if (BestIndex == INDEX_NONE)
				{
					break;
				}
				Current = BestIndex;
			}
		}
	}

	/** Flood-fill of walkable land reachable from a starting hex. */
	int32 LandmassFrom(const FHex& Start, const TArray<FWorldTile>& Tiles, int32 Width, int32 Height)
	{
		const int32 StartIndex = IndexOf(Start, Width, Height);
		if (StartIndex == INDEX_NONE)
		{
			return 0;
		}

		TSet<int32> Seen;
		Seen.Add(StartIndex);

		TArray<FHex> Stack;
		Stack.Add(Start);

		while (Stack.Num() > 0)
		{
			const FHex Here = Stack.Pop();
			for (const FHex& Neighbor : UHexLib::HexNeighbors(Here))
			{
				const int32 NeighborIndex = IndexOf(Neighbor, Width, Height);
				if (NeighborIndex == INDEX_NONE || Seen.Contains(NeighborIndex)
					|| Tiles[NeighborIndex].Terrain == LandnamTerrain::Ocean())
				{
					continue;
				}
				Seen.Add(NeighborIndex);
				Stack.Add(Neighbor);
			}
		}
		return Seen.Num();
	}

	/** The westernmost shore hex near mid-map — a lonely, exposed beach. */
	bool ChooseLanding(const TArray<FWorldTile>& Tiles, int32 Height, FHex& OutLanding)
	{
		const double MidRow = (Height - 1) / 2.0;

		TArray<FHex> Candidates;
		for (const FWorldTile& Tile : Tiles)
		{
			if (Tile.Terrain != LandnamTerrain::Shore())
			{
				continue;
			}
			if (FMath::Abs(Tile.Hex.R - MidRow) < Height * 0.3)
			{
				Candidates.Add(Tile.Hex);
			}
		}
		if (Candidates.Num() == 0)
		{
			return false;
		}

		// Stable, because the JS comparator returns 0 for two hexes in the same column
		// and equally far from mid-row, and Array.prototype.sort has been stable since
		// ES2019 — the tie then falls to row-major order.
		Candidates.StableSort([MidRow](const FHex& A, const FHex& B)
		{
			const int32 ColumnA = UHexLib::HexColumn(A);
			const int32 ColumnB = UHexLib::HexColumn(B);
			if (ColumnA != ColumnB)
			{
				return ColumnA < ColumnB;
			}
			return FMath::Abs(A.R - MidRow) < FMath::Abs(B.R - MidRow);
		});

		OutLanding = Candidates[0];
		return true;
	}

	bool GenerateOnce(ULandnamRng* Rng, int32 Width, int32 Height, FLandnamWorld& OutWorld)
	{
		const TArray<FField> Fields = BuildFields(Rng, Width, Height);

		TArray<FWorldTile> Tiles;
		Tiles.SetNum(Width * Height);
		for (int32 Row = 0; Row < Height; ++Row)
		{
			for (int32 Col = 0; Col < Width; ++Col)
			{
				const int32 Index = Row * Width + Col;
				FWorldTile& Tile = Tiles[Index];
				Tile.Hex = UHexLib::OffsetToAxial(Col, Row);
				Tile.Terrain = Classify(Fields[Index].Elevation, Fields[Index].Moisture);
				Tile.bRiver = false;
			}
		}

		MarkShore(Tiles, Width, Height);

		ULandnamRng* RiverRng = Rng->Derive(TEXT("rivers"));
		const int32 RiverCount = Rng->IntRange(3, 6);
		CarveRivers(RiverRng, Tiles, Fields, RiverCount, Width, Height);

		FHex Landing;
		if (!ChooseLanding(Tiles, Height, Landing))
		{
			return false;
		}
		if (LandmassFrom(Landing, Tiles, Width, Height) < ULandnamWorldgen::MinLandmass)
		{
			return false;
		}

		OutWorld.Width = Width;
		OutWorld.Height = Height;
		OutWorld.Tiles = MoveTemp(Tiles);
		OutWorld.Landing = Landing;
		OutWorld.bValid = true;
		return true;
	}
}

FLandnamWorld ULandnamWorldgen::GenerateWorldFromRng(ULandnamRng* Rng, int32 Width, int32 Height)
{
	FLandnamWorld World;
	if (Rng == nullptr || Width < 2 || Height < 2)
	{
		return World;
	}

	for (int32 Attempt = 0; Attempt < MaxAttempts; ++Attempt)
	{
		ULandnamRng* AttemptRng = Rng->Derive(FString::Printf(TEXT("attempt:%d"), Attempt));
		if (GenerateOnce(AttemptRng, Width, Height, World))
		{
			World.Attempts = Attempt + 1;
			return World;
		}
	}

	// The TS throws here. Blueprint has no exceptions, so the caller checks bValid —
	// which is also the only sane thing to do when a designer types a hostile seed.
	World.Attempts = MaxAttempts;
	return World;
}

FLandnamWorld ULandnamWorldgen::GenerateWorld(const FString& Seed, int32 Width, int32 Height)
{
	return GenerateWorldFromRng(ULandnamRng::MakeStream(Seed, ELandnamStream::Worldgen), Width, Height);
}

int32 ULandnamWorldgen::TileIndexOf(const FLandnamWorld& World, const FHex& Hex)
{
	return IndexOf(Hex, World.Width, World.Height);
}

FName ULandnamWorldgen::TerrainAt(const FLandnamWorld& World, const FHex& Hex)
{
	const int32 Index = IndexOf(Hex, World.Width, World.Height);
	return Index == INDEX_NONE ? NAME_None : World.Tiles[Index].Terrain;
}
