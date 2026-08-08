#include "LandnamRng.h"

#include "Containers/StringConv.h"

namespace
{
	// Seed word lists — must stay identical to SEED_FIRST / SEED_SECOND in src/rng.ts,
	// or a phrase generated in Unreal names a different saga than the same phrase does
	// in the browser.
	const TCHAR* SeedFirst[] = {
		TEXT("grim"), TEXT("salt"), TEXT("raven"), TEXT("storm"), TEXT("ash"),
		TEXT("iron"), TEXT("frost"), TEXT("wolf"), TEXT("amber"), TEXT("stone")
	};
	const TCHAR* SeedSecond[] = {
		TEXT("fjord"), TEXT("holm"), TEXT("vik"), TEXT("ness"), TEXT("skerry"),
		TEXT("dale"), TEXT("strand"), TEXT("fell"), TEXT("mark"), TEXT("sund")
	};
}

FString ULandnamRng::StreamName(ELandnamStream Stream)
{
	switch (Stream)
	{
	case ELandnamStream::Worldgen:	return TEXT("worldgen");
	case ELandnamStream::Party:		return TEXT("party");
	case ELandnamStream::Events:	return TEXT("events");
	case ELandnamStream::Combat:	return TEXT("combat");
	case ELandnamStream::Colony:	return TEXT("colony");
	case ELandnamStream::Saga:		return TEXT("saga");
	}
	return TEXT("worldgen");
}

int64 ULandnamRng::HashString(const FString& Text)
{
	// JS charCodeAt yields UTF-16 code units. TCHAR is UTF-32 on some platforms, so
	// convert explicitly rather than iterating TCHAR — otherwise a non-ASCII seed
	// would hash differently here than in the browser.
	auto Utf16 = StringCast<UTF16CHAR>(*Text);
	const UTF16CHAR* Chars = Utf16.Get();
	const int32 Length = Utf16.Length();

	uint32 Hash = 0x811c9dc5u;
	for (int32 I = 0; I < Length; I++)
	{
		Hash ^= static_cast<uint32>(Chars[I]);
		Hash *= 0x01000193u; // wraps at 32 bits, like Math.imul
	}
	return static_cast<int64>(Hash);
}

ULandnamRng* ULandnamRng::MakeRng(const FString& Seed)
{
	ULandnamRng* Rng = NewObject<ULandnamRng>();
	Rng->Init(Seed);
	return Rng;
}

ULandnamRng* ULandnamRng::MakeStream(const FString& Seed, ELandnamStream Stream)
{
	return MakeRng(FString::Printf(TEXT("%s#%s"), *Seed, *StreamName(Stream)));
}

void ULandnamRng::Init(const FString& InSeed)
{
	Seed = InSeed;
	State = static_cast<uint32>(HashString(InSeed));
}

double ULandnamRng::NextDouble()
{
	// mulberry32. All arithmetic is uint32 so it wraps exactly as the TS `| 0`,
	// `>>> 0` and Math.imul do — same bits in, same bits out.
	State = State + 0x6d2b79f5u;
	uint32 T = (State ^ (State >> 15)) * (1u | State);
	T = ((T + ((T ^ (T >> 7)) * (61u | T))) ^ T);
	return static_cast<double>(T ^ (T >> 14)) / 4294967296.0;
}

float ULandnamRng::Next()
{
	return static_cast<float>(NextDouble());
}

int32 ULandnamRng::IntRange(int32 Min, int32 Max)
{
	return Min + static_cast<int32>(FMath::FloorToDouble(NextDouble() * (static_cast<double>(Max) - Min + 1.0)));
}

float ULandnamRng::FloatRange(float Min, float Max)
{
	return static_cast<float>(Min + NextDouble() * (static_cast<double>(Max) - Min));
}

bool ULandnamRng::Chance(float P)
{
	return NextDouble() < static_cast<double>(P);
}

int32 ULandnamRng::Roll(int32 Count, int32 Sides)
{
	int32 Sum = 0;
	for (int32 I = 0; I < Count; I++) Sum += IntRange(1, Sides);
	return Sum;
}

int32 ULandnamRng::PickIndex(int32 Num)
{
	if (Num <= 0) return -1; // the TS throws; Blueprint would rather have a sentinel
	return IntRange(0, Num - 1);
}

TArray<int32> ULandnamRng::ShuffleIndices(int32 Num)
{
	TArray<int32> Indices;
	if (Num <= 0) return Indices;

	Indices.Reserve(Num);
	for (int32 I = 0; I < Num; I++) Indices.Add(I);

	// Descending Fisher-Yates, drawing in the same order as the TS in-place version.
	for (int32 I = Num - 1; I > 0; I--)
	{
		const int32 J = IntRange(0, I);
		Indices.Swap(I, J);
	}
	return Indices;
}

int32 ULandnamRng::WeightedIndex(const TArray<float>& Weights)
{
	if (Weights.Num() == 0) return -1;

	double Total = 0.0;
	for (const float W : Weights) Total += FMath::Max(0.0, static_cast<double>(W));

	// All weights zero or negative: fall back to a flat pick, as the TS does.
	if (Total <= 0.0) return PickIndex(Weights.Num());

	double Roll = NextDouble() * Total;
	for (int32 I = 0; I < Weights.Num(); I++)
	{
		Roll -= FMath::Max(0.0, static_cast<double>(Weights[I]));
		if (Roll < 0.0) return I;
	}
	return Weights.Num() - 1;
}

ULandnamRng* ULandnamRng::Derive(const FString& Label)
{
	return MakeRng(FString::Printf(TEXT("%s::%s"), *Seed, *Label));
}

FString ULandnamRng::MakeSeedPhrase(int64 Entropy)
{
	ULandnamRng* Rng = MakeRng(FString::Printf(TEXT("%lld"), Entropy));
	const FString First = SeedFirst[Rng->PickIndex(static_cast<int32>(UE_ARRAY_COUNT(SeedFirst)))];
	const FString Second = SeedSecond[Rng->PickIndex(static_cast<int32>(UE_ARRAY_COUNT(SeedSecond)))];
	return FString::Printf(TEXT("%s-%s-%d"), *First, *Second, Rng->IntRange(100, 999));
}
