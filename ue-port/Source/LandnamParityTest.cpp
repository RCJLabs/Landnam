// Proves the C++ hex and RNG ports behave identically to the TypeScript they came
// from. The vectors in Content/Data/golden.json are produced by the real src/hex and
// src/rng (see ue-port/tools/golden.mjs), so a pass here means a seed builds the same
// saga in Unreal as it does in the browser.
//
// Run it: Window > Test Automation > Landnam.Parity. Regenerate the vectors after any
// change to the TS hex or RNG code: node ue-port/tools/golden.mjs

#include "LandnamHex.h"
#include "LandnamRng.h"

#include "Misc/AutomationTest.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

#if WITH_AUTOMATION_TESTS

namespace
{
	/** Values are compared far tighter than any real drift, but not bit-exact, so
	 *  JSON round-tripping of doubles can never make the suite flaky. */
	constexpr double Tolerance = 1e-9;

	using FJsonArray = TArray<TSharedPtr<FJsonValue>>;

	/**
	 * Collects failures for one section and reports only the first few, so a broken
	 * port produces a readable diagnosis instead of thousands of log lines.
	 */
	struct FSection
	{
		FAutomationTestBase& Test;
		FString Name;
		int32 Checked = 0;
		int32 Failed = 0;
		static constexpr int32 MaxReported = 5;

		FSection(FAutomationTestBase& InTest, const FString& InName) : Test(InTest), Name(InName) {}

		void Expect(bool bCondition, const FString& Detail)
		{
			Checked++;
			if (bCondition) return;
			Failed++;
			if (Failed <= MaxReported) Test.AddError(FString::Printf(TEXT("[%s] %s"), *Name, *Detail));
		}

		void ExpectInt(int64 Actual, int64 Expected, const FString& Detail)
		{
			Expect(Actual == Expected,
				FString::Printf(TEXT("%s: got %lld, expected %lld"), *Detail, Actual, Expected));
		}

		void ExpectNear(double Actual, double Expected, const FString& Detail)
		{
			Expect(FMath::Abs(Actual - Expected) <= Tolerance,
				FString::Printf(TEXT("%s: got %.17g, expected %.17g"), *Detail, Actual, Expected));
		}

		/** Call once at the end; turns the tail of a large failure set into one line. */
		void Finish()
		{
			if (Failed > MaxReported)
			{
				Test.AddError(FString::Printf(TEXT("[%s] ...and %d more failures"), *Name, Failed - MaxReported));
			}
			Test.AddInfo(FString::Printf(TEXT("[%s] %d checks, %d failed"), *Name, Checked, Failed));
		}
	};

	int32 AsInt(const TSharedPtr<FJsonValue>& Value) { return static_cast<int32>(Value->AsNumber()); }

	/** Reads a [[q,r], [q,r], ...] array into hexes. */
	TArray<FHex> AsHexList(const FJsonArray& Array)
	{
		TArray<FHex> Out;
		Out.Reserve(Array.Num());
		for (const TSharedPtr<FJsonValue>& Entry : Array)
		{
			const FJsonArray& Pair = Entry->AsArray();
			Out.Add(FHex(AsInt(Pair[0]), AsInt(Pair[1])));
		}
		return Out;
	}

	FString HexListToString(const TArray<FHex>& Hexes)
	{
		TArray<FString> Parts;
		for (const FHex& H : Hexes) Parts.Add(H.ToKey());
		return FString::Join(Parts, TEXT(" "));
	}

	/** The cost field the golden path vectors were measured over — mirrors golden.mjs. */
	double GoldenCost(const FHex& Hex)
	{
		if (UHexLib::HexDistance(Hex, FHex(0, 0)) > 12) return LandnamHex::Impassable;
		if ((Hex.Q * 7 + Hex.R * 13) % 5 == 0) return LandnamHex::Impassable;
		return 1.0 + ((((Hex.Q * 3 + Hex.R * 5) % 4) + 4) % 4);
	}

	// ---- hex sections ----

	void CheckRound(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.round"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const double Qf = Case->GetNumberField(TEXT("qf"));
			const double Rf = Case->GetNumberField(TEXT("rf"));
			const FHex Got = UHexLib::HexRound(Qf, Rf);
			const FHex Want(Case->GetIntegerField(TEXT("q")), Case->GetIntegerField(TEXT("r")));
			S.Expect(Got == Want, FString::Printf(TEXT("round(%.17g, %.17g): got %s, expected %s"),
				Qf, Rf, *Got.ToKey(), *Want.ToKey()));
		}
		S.Finish();
	}

	void CheckToPixel(FAutomationTestBase& Test, const FJsonArray& Cases, double Size)
	{
		FSection S(Test, TEXT("hex.toPixel"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FHex At(Case->GetIntegerField(TEXT("q")), Case->GetIntegerField(TEXT("r")));
			const FVector2D Got = UHexLib::HexToPixel(At, Size);
			S.ExpectNear(Got.X, Case->GetNumberField(TEXT("x")), FString::Printf(TEXT("%s x"), *At.ToKey()));
			S.ExpectNear(Got.Y, Case->GetNumberField(TEXT("y")), FString::Printf(TEXT("%s y"), *At.ToKey()));

			// World placement must round-trip back to the hex it came from.
			const FVector World = UHexLib::HexToWorld(At, Size);
			S.Expect(UHexLib::HexFromWorld(World, Size) == At,
				FString::Printf(TEXT("%s did not survive HexToWorld/HexFromWorld"), *At.ToKey()));
		}
		S.Finish();
	}

	void CheckFromPixel(FAutomationTestBase& Test, const FJsonArray& Cases, double Size)
	{
		FSection S(Test, TEXT("hex.fromPixel"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const double X = Case->GetNumberField(TEXT("x"));
			const double Y = Case->GetNumberField(TEXT("y"));
			const FHex Got = UHexLib::HexFromPixel(X, Y, Size);
			const FHex Want(Case->GetIntegerField(TEXT("q")), Case->GetIntegerField(TEXT("r")));
			S.Expect(Got == Want, FString::Printf(TEXT("fromPixel(%g, %g): got %s, expected %s"),
				X, Y, *Got.ToKey(), *Want.ToKey()));
		}
		S.Finish();
	}

	void CheckDistance(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.distance"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FHex A(Case->GetIntegerField(TEXT("aq")), Case->GetIntegerField(TEXT("ar")));
			const FHex B(Case->GetIntegerField(TEXT("bq")), Case->GetIntegerField(TEXT("br")));
			S.ExpectInt(UHexLib::HexDistance(A, B), Case->GetIntegerField(TEXT("d")),
				FString::Printf(TEXT("distance(%s, %s)"), *A.ToKey(), *B.ToKey()));
		}
		S.Finish();
	}

	void CheckLine(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.line"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FHex A(Case->GetIntegerField(TEXT("aq")), Case->GetIntegerField(TEXT("ar")));
			const FHex B(Case->GetIntegerField(TEXT("bq")), Case->GetIntegerField(TEXT("br")));
			const TArray<FHex> Got = UHexLib::HexLine(A, B);
			const TArray<FHex> Want = AsHexList(Case->GetArrayField(TEXT("hexes")));
			S.Expect(Got == Want, FString::Printf(TEXT("line(%s, %s): got [%s], expected [%s]"),
				*A.ToKey(), *B.ToKey(), *HexListToString(Got), *HexListToString(Want)));
		}
		S.Finish();
	}

	void CheckNeighbors(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.neighbors"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FHex At(Case->GetIntegerField(TEXT("q")), Case->GetIntegerField(TEXT("r")));

			const TArray<FHex> Got = UHexLib::HexNeighbors(At);
			const TArray<FHex> Want = AsHexList(Case->GetArrayField(TEXT("neighbors")));
			S.Expect(Got == Want, FString::Printf(TEXT("neighbors(%s): got [%s], expected [%s]"),
				*At.ToKey(), *HexListToString(Got), *HexListToString(Want)));

			// The probe list is the six neighbours, then a far hex, then the hex itself.
			const FJsonArray& Dirs = Case->GetArrayField(TEXT("directionTo"));
			TArray<FHex> Probes = Got;
			Probes.Add(FHex(At.Q + 2, At.R));
			Probes.Add(At);
			for (int32 I = 0; I < Dirs.Num(); I++)
			{
				S.ExpectInt(UHexLib::HexDirectionTo(At, Probes[I]), AsInt(Dirs[I]),
					FString::Printf(TEXT("directionTo(%s, %s)"), *At.ToKey(), *Probes[I].ToKey()));
			}
		}
		S.Finish();
	}

	void CheckRingAndRange(FAutomationTestBase& Test, const FJsonArray& RingCases, const FJsonArray& RangeCases)
	{
		FSection S(Test, TEXT("hex.ring+range"));
		auto Run = [&S](const FJsonArray& Cases, bool bRing)
		{
			for (const TSharedPtr<FJsonValue>& Entry : Cases)
			{
				const TSharedPtr<FJsonObject> Case = Entry->AsObject();
				const FHex Centre(Case->GetIntegerField(TEXT("cq")), Case->GetIntegerField(TEXT("cr")));
				const int32 Radius = Case->GetIntegerField(TEXT("radius"));
				const TArray<FHex> Got = bRing ? UHexLib::HexRing(Centre, Radius) : UHexLib::HexRange(Centre, Radius);
				const TArray<FHex> Want = AsHexList(Case->GetArrayField(TEXT("hexes")));
				S.Expect(Got == Want, FString::Printf(TEXT("%s(%s, %d): got %d hexes [%s], expected %d [%s]"),
					bRing ? TEXT("ring") : TEXT("range"), *Centre.ToKey(), Radius,
					Got.Num(), *HexListToString(Got), Want.Num(), *HexListToString(Want)));
			}
		};
		Run(RingCases, true);
		Run(RangeCases, false);
		S.Finish();
	}

	void CheckOffset(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.offset"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const int32 Col = Case->GetIntegerField(TEXT("col"));
			const int32 Row = Case->GetIntegerField(TEXT("row"));

			const FHex Got = UHexLib::OffsetToAxial(Col, Row);
			const FHex Want(Case->GetIntegerField(TEXT("q")), Case->GetIntegerField(TEXT("r")));
			S.Expect(Got == Want, FString::Printf(TEXT("offsetToAxial(%d, %d): got %s, expected %s"),
				Col, Row, *Got.ToKey(), *Want.ToKey()));

			int32 BackCol = 0, BackRow = 0;
			UHexLib::AxialToOffset(Got, BackCol, BackRow);
			S.ExpectInt(BackCol, Case->GetIntegerField(TEXT("backCol")), TEXT("axialToOffset col"));
			S.ExpectInt(BackRow, Case->GetIntegerField(TEXT("backRow")), TEXT("axialToOffset row"));
			S.ExpectInt(UHexLib::HexColumn(Got), Case->GetIntegerField(TEXT("column")), TEXT("column"));
		}
		S.Finish();
	}

	void CheckPath(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.findPath"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FHex Start(Case->GetIntegerField(TEXT("sq")), Case->GetIntegerField(TEXT("sr")));
			const FHex Goal(Case->GetIntegerField(TEXT("gq")), Case->GetIntegerField(TEXT("gr")));

			const FHexPath Got = UHexLib::FindPathNative(Start, Goal, [](const FHex& H) { return GoldenCost(H); });
			const bool bWantReachable = Case->GetBoolField(TEXT("reachable"));
			const FString Label = FString::Printf(TEXT("findPath(%s -> %s)"), *Start.ToKey(), *Goal.ToKey());

			S.Expect(Got.bReachable == bWantReachable, FString::Printf(
				TEXT("%s: reachable %s, expected %s"), *Label,
				Got.bReachable ? TEXT("true") : TEXT("false"), bWantReachable ? TEXT("true") : TEXT("false")));
			if (!bWantReachable) continue;

			S.ExpectNear(Got.Cost, Case->GetNumberField(TEXT("cost")), FString::Printf(TEXT("%s cost"), *Label));

			// The exact route matters, not just its price — a different tie-break would
			// send units down a different corridor even at equal cost.
			const TArray<FHex> Want = AsHexList(Case->GetArrayField(TEXT("hexes")));
			S.Expect(Got.Hexes == Want, FString::Printf(TEXT("%s route: got [%s], expected [%s]"),
				*Label, *HexListToString(Got.Hexes), *HexListToString(Want)));
		}
		S.Finish();
	}

	void CheckReachable(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("hex.reachable"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FHex Start(Case->GetIntegerField(TEXT("sq")), Case->GetIntegerField(TEXT("sr")));
			const double Budget = Case->GetNumberField(TEXT("budget"));
			const FString Label = FString::Printf(TEXT("reachable(%s, %g)"), *Start.ToKey(), Budget);

			TMap<FHex, double> Got = UHexLib::ReachableNative(Start, Budget, [](const FHex& H) { return GoldenCost(H); });
			const FJsonArray& Want = Case->GetArrayField(TEXT("entries"));

			S.ExpectInt(Got.Num(), Want.Num(), FString::Printf(TEXT("%s size"), *Label));
			for (const TSharedPtr<FJsonValue>& WantEntry : Want)
			{
				const TSharedPtr<FJsonObject> Item = WantEntry->AsObject();
				const FHex At(Item->GetIntegerField(TEXT("q")), Item->GetIntegerField(TEXT("r")));
				const double* GotCost = Got.Find(At);
				if (GotCost == nullptr)
				{
					S.Expect(false, FString::Printf(TEXT("%s: missing %s"), *Label, *At.ToKey()));
					continue;
				}
				S.ExpectNear(*GotCost, Item->GetNumberField(TEXT("cost")),
					FString::Printf(TEXT("%s cost at %s"), *Label, *At.ToKey()));
			}
		}
		S.Finish();
	}

	// ---- rng sections ----

	void CheckHashString(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("rng.hashString"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const FString Text = Case->GetStringField(TEXT("text"));
			S.ExpectInt(ULandnamRng::HashString(Text), static_cast<int64>(Case->GetNumberField(TEXT("hash"))),
				FString::Printf(TEXT("hashString(\"%s\")"), *Text));
		}
		S.Finish();
	}

	void CheckStreams(FAutomationTestBase& Test, const FJsonArray& Cases, const FString& Seed)
	{
		FSection S(Test, TEXT("rng.streams"));

		// Same order as ELandnamStream and as STREAM_NAMES in golden.mjs.
		const ELandnamStream Order[] = {
			ELandnamStream::Worldgen, ELandnamStream::Party, ELandnamStream::Events,
			ELandnamStream::Combat, ELandnamStream::Colony, ELandnamStream::Saga
		};

		for (int32 I = 0; I < Cases.Num() && I < static_cast<int32>(UE_ARRAY_COUNT(Order)); I++)
		{
			const TSharedPtr<FJsonObject> Case = Cases[I]->AsObject();
			const ELandnamStream Stream = Order[I];
			const FString Name = Case->GetStringField(TEXT("name"));

			S.Expect(ULandnamRng::StreamName(Stream) == Name, FString::Printf(
				TEXT("stream %d is named %s here but %s in the TS"), I, *ULandnamRng::StreamName(Stream), *Name));
			S.Expect(ULandnamRng::MakeStream(Seed, Stream)->GetSeed() == Case->GetStringField(TEXT("seed")),
				FString::Printf(TEXT("stream %s salts its seed differently"), *Name));

			// The raw 32-bit draws are the real proof: integers survive JSON exactly,
			// so any divergence in the generator shows up here first.
			{
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				const FJsonArray& Want = Case->GetArrayField(TEXT("nextRaw"));
				for (int32 D = 0; D < Want.Num(); D++)
				{
					const uint32 GotRaw = static_cast<uint32>(Rng->NextDouble() * 4294967296.0);
					const uint32 WantRaw = static_cast<uint32>(Want[D]->AsNumber());
					S.ExpectInt(GotRaw, WantRaw, FString::Printf(TEXT("%s next() draw %d"), *Name, D));
				}
			}

			auto CheckIntSeries = [&](const TCHAR* Field, TFunctionRef<int32(ULandnamRng&)> Draw)
			{
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				const FJsonArray& Want = Case->GetArrayField(Field);
				for (int32 D = 0; D < Want.Num(); D++)
				{
					S.ExpectInt(Draw(*Rng), AsInt(Want[D]),
						FString::Printf(TEXT("%s %s draw %d"), *Name, Field, D));
				}
			};

			CheckIntSeries(TEXT("ints"), [](ULandnamRng& R) { return R.IntRange(1, 6); });
			CheckIntSeries(TEXT("wideInts"), [](ULandnamRng& R) { return R.IntRange(-50, 250); });
			CheckIntSeries(TEXT("rolls"), [](ULandnamRng& R) { return R.Roll(2, 6); });

			{
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				const FJsonArray& Want = Case->GetArrayField(TEXT("chances"));
				for (int32 D = 0; D < Want.Num(); D++)
				{
					const bool Got = Rng->Chance(0.3f);
					S.Expect(Got == Want[D]->AsBool(),
						FString::Printf(TEXT("%s chance draw %d: got %s"), *Name, D, Got ? TEXT("true") : TEXT("false")));
				}
			}

			{
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				const FJsonArray& Want = Case->GetArrayField(TEXT("floats"));
				for (int32 D = 0; D < Want.Num(); D++)
				{
					S.ExpectNear(Rng->FloatRange(-2.5f, 7.5f), Want[D]->AsNumber(),
						FString::Printf(TEXT("%s float draw %d"), *Name, D));
				}
			}

			{
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				for (const TSharedPtr<FJsonValue>& WantShuffle : Case->GetArrayField(TEXT("shuffles")))
				{
					const FJsonArray& Want = WantShuffle->AsArray();
					const TArray<int32> Got = Rng->ShuffleIndices(Want.Num());
					for (int32 D = 0; D < Want.Num(); D++)
					{
						S.ExpectInt(Got.IsValidIndex(D) ? Got[D] : -1, AsInt(Want[D]),
							FString::Printf(TEXT("%s shuffle slot %d"), *Name, D));
					}
				}
			}

			{
				TArray<float> Weights;
				for (const TSharedPtr<FJsonValue>& W : Case->GetArrayField(TEXT("weights")))
				{
					Weights.Add(static_cast<float>(W->AsNumber()));
				}
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				const FJsonArray& Want = Case->GetArrayField(TEXT("weighted"));
				for (int32 D = 0; D < Want.Num(); D++)
				{
					S.ExpectInt(Rng->WeightedIndex(Weights), AsInt(Want[D]),
						FString::Printf(TEXT("%s weighted draw %d"), *Name, D));
				}
			}

			// Derived sub-streams must be seeded the same way, or per-turn rolls diverge.
			{
				ULandnamRng* Rng = ULandnamRng::MakeStream(Seed, Stream);
				for (const TSharedPtr<FJsonValue>& WantDerived : Case->GetArrayField(TEXT("derived")))
				{
					const TSharedPtr<FJsonObject> Item = WantDerived->AsObject();
					const FString Label = Item->GetStringField(TEXT("label"));
					ULandnamRng* Sub = Rng->Derive(Label);

					S.Expect(Sub->GetSeed() == Item->GetStringField(TEXT("seed")), FString::Printf(
						TEXT("%s derive(\"%s\") seed: got %s, expected %s"), *Name, *Label,
						*Sub->GetSeed(), *Item->GetStringField(TEXT("seed"))));

					const FJsonArray& Want = Item->GetArrayField(TEXT("raw"));
					for (int32 D = 0; D < Want.Num(); D++)
					{
						S.ExpectInt(static_cast<uint32>(Sub->NextDouble() * 4294967296.0),
							static_cast<uint32>(Want[D]->AsNumber()),
							FString::Printf(TEXT("%s derive(\"%s\") draw %d"), *Name, *Label, D));
					}
				}
			}
		}
		S.Finish();
	}

	void CheckSeedPhrases(FAutomationTestBase& Test, const FJsonArray& Cases)
	{
		FSection S(Test, TEXT("rng.seedPhrase"));
		for (const TSharedPtr<FJsonValue>& Entry : Cases)
		{
			const TSharedPtr<FJsonObject> Case = Entry->AsObject();
			const int64 Entropy = static_cast<int64>(Case->GetNumberField(TEXT("entropy")));
			const FString Got = ULandnamRng::MakeSeedPhrase(Entropy);
			const FString Want = Case->GetStringField(TEXT("phrase"));
			S.Expect(Got == Want, FString::Printf(TEXT("makeSeedPhrase(%lld): got %s, expected %s"),
				Entropy, *Got, *Want));
		}
		S.Finish();
	}
}

IMPLEMENT_SIMPLE_AUTOMATION_TEST(
	FLandnamParityTest, "Landnam.Parity",
	EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)

bool FLandnamParityTest::RunTest(const FString& Parameters)
{
	const FString GoldenPath = FPaths::ProjectContentDir() / TEXT("Data/golden.json");

	FString Raw;
	if (!FFileHelper::LoadFileToString(Raw, *GoldenPath))
	{
		AddError(FString::Printf(
			TEXT("Could not read %s. Copy ue-port/Content/Data/golden.json into the project's ")
			TEXT("Content/Data folder, or regenerate it with: node ue-port/tools/golden.mjs"), *GoldenPath));
		return false;
	}

	TSharedPtr<FJsonObject> Root;
	const TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Raw);
	if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid())
	{
		AddError(FString::Printf(TEXT("%s is not valid JSON."), *GoldenPath));
		return false;
	}

	const TSharedPtr<FJsonObject> Hex = Root->GetObjectField(TEXT("hex"));
	const TSharedPtr<FJsonObject> Rng = Root->GetObjectField(TEXT("rng"));
	const double Size = Root->GetNumberField(TEXT("hexSize"));

	CheckRound(*this, Hex->GetArrayField(TEXT("round")));
	CheckToPixel(*this, Hex->GetArrayField(TEXT("toPixel")), Size);
	CheckFromPixel(*this, Hex->GetArrayField(TEXT("fromPixel")), Size);
	CheckDistance(*this, Hex->GetArrayField(TEXT("distance")));
	CheckLine(*this, Hex->GetArrayField(TEXT("line")));
	CheckNeighbors(*this, Hex->GetArrayField(TEXT("neighbors")));
	CheckRingAndRange(*this, Hex->GetArrayField(TEXT("ring")), Hex->GetArrayField(TEXT("range")));
	CheckOffset(*this, Hex->GetArrayField(TEXT("offset")));
	CheckPath(*this, Hex->GetArrayField(TEXT("path")));
	CheckReachable(*this, Hex->GetArrayField(TEXT("reachable")));

	CheckHashString(*this, Rng->GetArrayField(TEXT("hashString")));
	CheckStreams(*this, Rng->GetArrayField(TEXT("streams")), TEXT("raven-skerry-317"));
	CheckSeedPhrases(*this, Rng->GetArrayField(TEXT("seedPhrases")));

	return true;
}

#endif // WITH_AUTOMATION_TESTS
