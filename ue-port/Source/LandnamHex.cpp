#include "LandnamHex.h"

#include "Algo/Reverse.h"

// Everything here computes in double, not float. JavaScript numbers are doubles,
// and the parity test compares against values produced by the TS — narrowing to
// float would drift on HexRound and HexLine near tie boundaries.

namespace
{
	const double Sqrt3 = FMath::Sqrt(3.0);

	using LandnamHex::Impassable;
	using LandnamHex::IsPassable;

	/**
	 * JavaScript's Math.round rounds halves toward +Infinity (so -0.5 -> 0), which
	 * is floor(x + 0.5). UE's FMath::RoundToInt does the same today, but HexRound is
	 * parity-critical, so spell it out rather than depend on that staying true.
	 */
	FORCEINLINE double RoundHalfUp(double Value) { return FMath::FloorToDouble(Value + 0.5); }

	/** One entry in the open set. Mirrors the TS `HeapEntry`. */
	struct FHeapEntry
	{
		FHex Hex;
		double Priority = 0.0;
	};

	// The TS hand-rolls its binary heap. Porting it verbatim — rather than using
	// TArray's HeapPush/HeapPop — keeps tie-breaking identical, so equal-cost paths
	// come out in the same order on both sides.

	void HeapPush(TArray<FHeapEntry>& Heap, const FHeapEntry& Entry)
	{
		Heap.Add(Entry);
		int32 I = Heap.Num() - 1;
		while (I > 0)
		{
			const int32 Parent = (I - 1) >> 1;
			if (Heap[Parent].Priority <= Heap[I].Priority) break;
			Swap(Heap[Parent], Heap[I]);
			I = Parent;
		}
	}

	bool HeapPop(TArray<FHeapEntry>& Heap, FHeapEntry& OutTop)
	{
		if (Heap.Num() == 0) return false;

		OutTop = Heap[0];
		const FHeapEntry Last = Heap.Pop(EAllowShrinking::No);
		if (Heap.Num() > 0)
		{
			Heap[0] = Last;
			int32 I = 0;
			for (;;)
			{
				const int32 L = 2 * I + 1;
				const int32 R = L + 1;
				int32 Smallest = I;
				if (L < Heap.Num() && Heap[L].Priority < Heap[Smallest].Priority) Smallest = L;
				if (R < Heap.Num() && Heap[R].Priority < Heap[Smallest].Priority) Smallest = R;
				if (Smallest == I) break;
				Swap(Heap[Smallest], Heap[I]);
				I = Smallest;
			}
		}
		return true;
	}
}

FHex FHex::FromKey(const FString& Key)
{
	FString Left, Right;
	if (!Key.Split(TEXT(","), &Left, &Right)) return FHex();
	return FHex(FCString::Atoi(*Left), FCString::Atoi(*Right));
}

// ---- Construction and space conversion ----

FHex UHexLib::HexRound(double Qf, double Rf)
{
	const double QFrac = Qf;
	const double RFrac = Rf;
	const double SFrac = -QFrac - RFrac;

	double Q = RoundHalfUp(QFrac);
	double R = RoundHalfUp(RFrac);
	const double S = RoundHalfUp(SFrac);

	const double DQ = FMath::Abs(Q - QFrac);
	const double DR = FMath::Abs(R - RFrac);
	const double DS = FMath::Abs(S - SFrac);

	// Discard whichever coordinate drifted furthest, so Q + R + S stays 0.
	if (DQ > DR && DQ > DS) Q = -R - S;
	else if (DR > DS) R = -Q - S;

	return FHex(static_cast<int32>(Q), static_cast<int32>(R));
}

FVector2D UHexLib::HexToPixel(const FHex& Hex, double Size)
{
	return FVector2D(
		Size * (Sqrt3 * Hex.Q + (Sqrt3 / 2.0) * Hex.R),
		Size * 1.5 * Hex.R);
}

FHex UHexLib::HexFromPixel(double X, double Y, double Size)
{
	const double QFrac = ((Sqrt3 / 3.0) * X - (1.0 / 3.0) * Y) / Size;
	const double RFrac = ((2.0 / 3.0) * Y) / Size;
	return HexRound(QFrac, RFrac);
}

FVector UHexLib::HexToWorld(const FHex& Hex, double Size, double Z)
{
	const FVector2D P = HexToPixel(Hex, Size);
	// Pixel space is x-east / y-south; Unreal is X-north / Y-east.
	return FVector(-P.Y, P.X, Z);
}

FHex UHexLib::HexFromWorld(const FVector& Location, double Size)
{
	return HexFromPixel(Location.Y, -Location.X, Size);
}

TArray<FVector2D> UHexLib::HexCorners(double CX, double CY, double Size)
{
	TArray<FVector2D> Points;
	Points.Reserve(6);
	for (int32 I = 0; I < 6; I++)
	{
		const double Angle = (UE_DOUBLE_PI / 180.0) * (60.0 * I - 30.0); // pointy-top
		Points.Add(FVector2D(CX + Size * FMath::Cos(Angle), CY + Size * FMath::Sin(Angle)));
	}
	return Points;
}

// ---- Offset space ----

FHex UHexLib::OffsetToAxial(int32 Col, int32 Row)
{
	return FHex(Col - ((Row - (Row & 1)) >> 1), Row);
}

void UHexLib::AxialToOffset(const FHex& Hex, int32& Col, int32& Row)
{
	Col = Hex.Q + ((Hex.R - (Hex.R & 1)) >> 1);
	Row = Hex.R;
}

int32 UHexLib::HexColumn(const FHex& Hex)
{
	return Hex.Q + ((Hex.R - (Hex.R & 1)) >> 1);
}

// ---- Neighbourhood and shape ----

const TArray<FHex>& UHexLib::Directions()
{
	// 0 = east, then counter-clockwise, so (Dir + 3) % 6 is always the opposite.
	static const TArray<FHex> Dirs = {
		FHex(1, 0), FHex(1, -1), FHex(0, -1),
		FHex(-1, 0), FHex(-1, 1), FHex(0, 1)
	};
	return Dirs;
}

FHex UHexLib::HexNeighbor(const FHex& Hex, int32 Direction)
{
	const FHex& D = Directions()[((Direction % 6) + 6) % 6];
	return FHex(Hex.Q + D.Q, Hex.R + D.R);
}

TArray<FHex> UHexLib::HexNeighbors(const FHex& Hex)
{
	TArray<FHex> Out;
	Out.Reserve(6);
	for (const FHex& D : Directions()) Out.Add(FHex(Hex.Q + D.Q, Hex.R + D.R));
	return Out;
}

int32 UHexLib::HexDistance(const FHex& A, const FHex& B)
{
	const int32 DQ = A.Q - B.Q;
	const int32 DR = A.R - B.R;
	return (FMath::Abs(DQ) + FMath::Abs(DR) + FMath::Abs(DQ + DR)) / 2;
}

int32 UHexLib::HexDirectionTo(const FHex& A, const FHex& B)
{
	const TArray<FHex>& Dirs = Directions();
	for (int32 I = 0; I < Dirs.Num(); I++)
	{
		if (A.Q + Dirs[I].Q == B.Q && A.R + Dirs[I].R == B.R) return I;
	}
	return -1;
}

TArray<FHex> UHexLib::HexRing(const FHex& Center, int32 Radius)
{
	TArray<FHex> Out;
	if (Radius <= 0)
	{
		Out.Add(Center);
		return Out;
	}

	Out.Reserve(6 * Radius);
	FHex H(Center.Q - Radius, Center.R + Radius);
	for (int32 Side = 0; Side < 6; Side++)
	{
		for (int32 Step = 0; Step < Radius; Step++)
		{
			Out.Add(H);
			H = HexNeighbor(H, Side);
		}
	}
	return Out;
}

TArray<FHex> UHexLib::HexRange(const FHex& Center, int32 Radius)
{
	TArray<FHex> Out;
	for (int32 RR = 0; RR <= Radius; RR++) Out.Append(HexRing(Center, RR));
	return Out;
}

TArray<FHex> UHexLib::HexLine(const FHex& A, const FHex& B)
{
	const int32 N = HexDistance(A, B);
	TArray<FHex> Out;
	if (N == 0)
	{
		Out.Add(A);
		return Out;
	}

	Out.Reserve(N + 1);
	for (int32 I = 0; I <= N; I++)
	{
		const double T = static_cast<double>(I) / static_cast<double>(N);
		// The epsilon nudge breaks exact-tie rounding the same way every run.
		const double QF = A.Q + (B.Q - A.Q) * T + 1e-6;
		const double RF = A.R + (B.R - A.R) * T + 1e-6;
		Out.Add(HexRound(QF, RF));
	}
	return Out;
}

// ---- Pathfinding ----

FHexPath UHexLib::FindPathNative(const FHex& Start, const FHex& Goal, TFunctionRef<double(const FHex&)> Cost)
{
	FHexPath Result;

	if (Start == Goal)
	{
		Result.Hexes.Add(Start);
		Result.Cost = 0.0;
		Result.bReachable = true;
		return Result;
	}
	if (!IsPassable(Cost(Goal))) return Result;

	TMap<FHex, double> GScore;
	TMap<FHex, FHex> CameFrom;
	TSet<FHex> Closed;
	TArray<FHeapEntry> Open;

	GScore.Add(Start, 0.0);
	HeapPush(Open, { Start, static_cast<double>(HexDistance(Start, Goal)) });

	FHeapEntry Current;
	while (HeapPop(Open, Current))
	{
		if (Closed.Contains(Current.Hex)) continue;

		if (Current.Hex == Goal)
		{
			// Walk the parent chain back to the start, then flip it.
			TArray<FHex> Reversed;
			FHex Step = Goal;
			for (;;)
			{
				Reversed.Add(Step);
				const FHex* Prev = CameFrom.Find(Step);
				if (Prev == nullptr) break;
				Step = *Prev;
			}
			Algo::Reverse(Reversed);

			Result.Hexes = MoveTemp(Reversed);
			Result.Cost = GScore[Goal];
			Result.bReachable = true;
			return Result;
		}
		Closed.Add(Current.Hex);

		const double G = GScore[Current.Hex];
		for (const FHex& Next : HexNeighbors(Current.Hex))
		{
			if (Closed.Contains(Next)) continue;

			const double StepCost = Cost(Next);
			if (!IsPassable(StepCost)) continue;

			const double Tentative = G + StepCost;
			const double* Known = GScore.Find(Next);
			if (Known == nullptr || Tentative < *Known)
			{
				GScore.Add(Next, Tentative);
				CameFrom.Add(Next, Current.Hex);
				HeapPush(Open, { Next, Tentative + static_cast<double>(HexDistance(Next, Goal)) });
			}
		}
	}

	return Result; // unreachable: empty path, Cost -1, bReachable false
}

TMap<FHex, double> UHexLib::ReachableNative(const FHex& Start, double Budget, TFunctionRef<double(const FHex&)> Cost)
{
	TMap<FHex, double> Best;
	Best.Add(Start, 0.0);

	TArray<FHeapEntry> Frontier;
	HeapPush(Frontier, { Start, 0.0 });

	FHeapEntry Current;
	while (HeapPop(Frontier, Current))
	{
		const double* D = Best.Find(Current.Hex);
		// A stale heap entry — we already found a cheaper way in.
		if (D == nullptr || Current.Priority > *D) continue;

		for (const FHex& Next : HexNeighbors(Current.Hex))
		{
			const double StepCost = Cost(Next);
			if (!IsPassable(StepCost)) continue;

			const double Total = Current.Priority + StepCost;
			if (Total > Budget) continue;

			const double* Known = Best.Find(Next);
			if (Known == nullptr || Total < *Known)
			{
				Best.Add(Next, Total);
				HeapPush(Frontier, { Next, Total });
			}
		}
	}
	return Best;
}

// ---- Blueprint-facing wrappers ----

namespace
{
	/** Negative or non-finite from Blueprint means impassable. */
	double CostFromDelegate(const FHexCostDelegate& Cost, const FHex& Hex)
	{
		if (!Cost.IsBound()) return 1.0;
		const float Value = Cost.Execute(Hex);
		if (!FMath::IsFinite(Value) || Value < 0.0f) return Impassable;
		return static_cast<double>(Value);
	}

	/** Absent from the map is impassable, and so is a negative entry. */
	double CostFromMap(const TMap<FHex, double>& Costs, const FHex& Hex)
	{
		const double* Found = Costs.Find(Hex);
		if (Found == nullptr || *Found < 0.0) return Impassable;
		return *Found;
	}
}

FHexPath UHexLib::FindPath(const FHex& Start, const FHex& Goal, const FHexCostDelegate& Cost)
{
	return FindPathNative(Start, Goal, [&Cost](const FHex& H) { return CostFromDelegate(Cost, H); });
}

namespace
{
	/** Shared by both Blueprint-facing Reachable forms. */
	TArray<FHexReach> ToReachArray(const TMap<FHex, double>& Best)
	{
		TArray<FHexReach> Out;
		Out.Reserve(Best.Num());
		for (const TPair<FHex, double>& Pair : Best)
		{
			FHexReach Entry;
			Entry.Hex = Pair.Key;
			Entry.Cost = Pair.Value;
			Out.Add(Entry);
		}
		return Out;
	}
}

TArray<FHexReach> UHexLib::Reachable(const FHex& Start, double Budget, const FHexCostDelegate& Cost)
{
	return ToReachArray(ReachableNative(
		Start, Budget,
		[&Cost](const FHex& H) { return CostFromDelegate(Cost, H); }));
}

TArray<FHexReach> UHexLib::ReachableInMap(const FHex& Start, double Budget, const TMap<FHex, double>& Costs)
{
	return ToReachArray(ReachableNative(
		Start, Budget,
		[&Costs](const FHex& H) { return CostFromMap(Costs, H); }));
}

FHexPath UHexLib::FindPathInMap(const FHex& Start, const FHex& Goal, const TMap<FHex, double>& Costs)
{
	return FindPathNative(Start, Goal, [&Costs](const FHex& H) { return CostFromMap(Costs, H); });
}
