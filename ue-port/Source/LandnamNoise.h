// Seeded fractal value noise — a port of src/sim/noise.ts.
//
// Deterministic and dependency-free, exactly as the TS is: the whole landmass is
// a pure function of the worldgen stream. Every arithmetic step below is double
// precision in the same order as the original, because the coastline sits on
// `elevation < 0.5` and a difference in the last bit moves a hex from land to sea.
//
// Ported from: src/sim/noise.ts

#pragma once

#include "CoreMinimal.h"

class ULandnamRng;

/**
 * Single-octave value noise in [0, 1).
 *
 * The lookup table is 256x256 doubles drawn straight from the generator, so the
 * table contents — and therefore the terrain — depend on the exact number and
 * order of draws. Do not "optimise" the fill loop.
 */
struct FLandnamValueNoise
{
	static constexpr int32 TableSize = 256;
	static constexpr int32 TableMask = TableSize - 1;

	/** TableSize * TableSize values in [0, 1), filled in row-major order. */
	TArray<double> Values;

	void Init(ULandnamRng* Rng);

	double Sample(double X, double Y) const;

private:
	/**
	 * Wrapping lookup. The mask matches JS `&`, which coerces to int32 first —
	 * so a negative coordinate wraps to the far edge in both languages.
	 */
	FORCEINLINE double At(int32 X, int32 Y) const
	{
		return Values[(Y & TableMask) * TableSize + (X & TableMask)];
	}
};

/**
 * Fractal Brownian motion over value noise, normalised to [0, 1].
 * More octaves means more coastline detail.
 */
struct FLandnamFbm
{
	TArray<FLandnamValueNoise> Layers;

	double Lacunarity = 2.0;
	double Gain = 0.5;
	double MaxAmplitude = 0.0;

	/** Derives one sub-stream per octave, labelled "octave:N" as the TS does. */
	void Init(ULandnamRng* Rng, int32 Octaves, double InLacunarity = 2.0, double InGain = 0.5);

	double Sample(double X, double Y) const;
};
