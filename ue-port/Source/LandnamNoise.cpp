// Ported from: src/sim/noise.ts

#include "LandnamNoise.h"

#include "LandnamRng.h"

namespace
{
	FORCEINLINE double Smoothstep(double T)
	{
		return T * T * (3.0 - 2.0 * T);
	}
}

void FLandnamValueNoise::Init(ULandnamRng* Rng)
{
	Values.SetNumUninitialized(TableSize * TableSize);
	for (int32 Index = 0; Index < Values.Num(); ++Index)
	{
		Values[Index] = Rng->NextDouble();
	}
}

double FLandnamValueNoise::Sample(double X, double Y) const
{
	// FloorToDouble then cast, rather than a direct int cast: C++ truncates toward
	// zero and JS `Math.floor` rounds down, which disagree for negative inputs.
	const int32 X0 = static_cast<int32>(FMath::FloorToDouble(X));
	const int32 Y0 = static_cast<int32>(FMath::FloorToDouble(Y));

	const double Fx = Smoothstep(X - X0);
	const double Fy = Smoothstep(Y - Y0);

	const double Top = At(X0, Y0) * (1.0 - Fx) + At(X0 + 1, Y0) * Fx;
	const double Bottom = At(X0, Y0 + 1) * (1.0 - Fx) + At(X0 + 1, Y0 + 1) * Fx;
	return Top * (1.0 - Fy) + Bottom * Fy;
}

void FLandnamFbm::Init(ULandnamRng* Rng, int32 Octaves, double InLacunarity, double InGain)
{
	Lacunarity = InLacunarity;
	Gain = InGain;

	Layers.SetNum(Octaves);
	for (int32 Index = 0; Index < Octaves; ++Index)
	{
		Layers[Index].Init(Rng->Derive(FString::Printf(TEXT("octave:%d"), Index)));
	}

	// Accumulated the same way round as the TS, so the divisor matches bit for bit.
	MaxAmplitude = 0.0;
	double Amplitude = 1.0;
	for (int32 Index = 0; Index < Octaves; ++Index)
	{
		MaxAmplitude += Amplitude;
		Amplitude *= Gain;
	}
}

double FLandnamFbm::Sample(double X, double Y) const
{
	double Total = 0.0;
	double Amp = 1.0;
	double Freq = 1.0;
	for (const FLandnamValueNoise& Layer : Layers)
	{
		Total += Layer.Sample(X * Freq, Y * Freq) * Amp;
		Freq *= Lacunarity;
		Amp *= Gain;
	}
	return Total / MaxAmplitude;
}
