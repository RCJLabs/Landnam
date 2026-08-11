// The RNG contract, in C++. See port/rng.md.
//
// This is the reference a port checks itself against: it prints every value
// pinned in port/rng-fixture.json, tagged and in fixture order, so the two
// can be compared line for line. It is NOT built or run by `npm test` —
// this repo has no C++ toolchain requirement and is not going to grow one.
// It was compiled and checked against the fixture when it was written
// (g++ 13.3, 174 of 174 values matching, including the Norse and emoji
// hash cases); the JSON is the authority if they ever disagree.
//
//   g++ -O2 -o rng_reference port/rng_reference.cpp && ./rng_reference
//
// and compare with the snippet at the end of port/rng.md.
#include <cstdint>
#include <string>
#include <vector>
#include <cmath>
#include <cstdio>

uint32_t hashString(const std::vector<uint16_t>& units) {
    uint32_t h = 0x811c9dc5u;
    for (uint16_t u : units) { h ^= u; h = h * 0x01000193u; }
    return h;
}
struct Rng {
    uint32_t a;
    explicit Rng(uint32_t seed) : a(seed) {}
    uint32_t nextU32() {
        a = a + 0x6d2b79f5u;
        uint32_t t = (a ^ (a >> 15)) * (1u | a);
        t = (t + (t ^ (t >> 7)) * (61u | t)) ^ t;
        return t ^ (t >> 14);
    }
    double next() { return nextU32() / 4294967296.0; }
    int32_t intInclusive(int32_t lo, int32_t hi) {
        return lo + (int32_t)std::floor(next() * (double)(hi - lo + 1));
    }
    int32_t roll(int count, int sides) {
        int32_t s = 0; for (int i = 0; i < count; ++i) s += intInclusive(1, sides); return s;
    }
};

// UTF-8 in, UTF-16 code units out — the hazard the spec warns about.
std::vector<uint16_t> utf16(const std::string& s) {
    std::vector<uint16_t> out; size_t i = 0;
    while (i < s.size()) {
        unsigned char c = s[i]; uint32_t cp; int len;
        if (c < 0x80) { cp = c; len = 1; }
        else if ((c >> 5) == 0x6) { cp = c & 0x1F; len = 2; }
        else if ((c >> 4) == 0xE) { cp = c & 0x0F; len = 3; }
        else { cp = c & 0x07; len = 4; }
        for (int k = 1; k < len; ++k) cp = (cp << 6) | (s[i + k] & 0x3F);
        i += len;
        if (cp < 0x10000) out.push_back((uint16_t)cp);
        else { cp -= 0x10000; out.push_back((uint16_t)(0xD800 + (cp >> 10)));
               out.push_back((uint16_t)(0xDC00 + (cp & 0x3FF))); }
    }
    return out;
}
Rng at(const std::string& seed) { return Rng(hashString(utf16(seed))); }

int main() {
    // Emitted as JSON-ish lines for the checker to compare.
    const char* hashes[] = {"", "a", "0", "landnam", "raven-skerry-317", "\xC3\x9E\xC3\xB3rr",
        "r\xC3\xADki", "Hvallund", "\xC7\xAB", "\xF0\x9F\x98\x80", "seed#worldgen",
        "seed::day:3", "strike:p1:12:3:4",
        "the-quick-brown-fox-jumps-over-the-lazy-dog-and-keeps-going-for-a-while-yet"};
    for (auto h : hashes) printf("H %u\n", hashString(utf16(h)));

    const char* seeds[] = {"landnam", "", "raven-skerry-317", "\xC3\x9E\xC3\xB3rr-r\xC3\xADki",
        "\xF0\x9F\x98\x80", "curve-0"};
    for (auto s : seeds) { Rng r = at(s); for (int i = 0; i < 8; ++i) printf("D %u\n", r.nextU32()); }

    const char* streams[] = {"worldgen","party","events","combat","colony","saga"};
    for (auto n : streams) { Rng r = at(std::string("landnam#") + n); for (int i=0;i<4;++i) printf("S %u\n", r.nextU32()); }

    { Rng r = at("root::day:3"); for (int i=0;i<4;++i) printf("V %u\n", r.nextU32()); }
    { Rng r = at("root::day:3::hex:2,-1"); for (int i=0;i<4;++i) printf("V %u\n", r.nextU32()); }
    { Rng r = at("landnam::worldgen"); for (int i=0;i<4;++i) printf("V %u\n", r.nextU32()); }
    { Rng r = at("landnam#combat::strike:p1:12:3:4"); for (int i=0;i<4;++i) printf("V %u\n", r.nextU32()); }

    { Rng r = at("ints"); for (int i=0;i<12;++i) printf("I %d\n", r.intInclusive(0,1)); }
    { Rng r = at("ints"); for (int i=0;i<12;++i) printf("I %d\n", r.intInclusive(1,6)); }
    { Rng r = at("ints"); for (int i=0;i<12;++i) printf("I %d\n", r.intInclusive(-3,3)); }
    { Rng r = at("ints"); for (int i=0;i<4;++i) printf("I %d\n", r.intInclusive(5,5)); }
    { Rng r = at("ints"); for (int i=0;i<6;++i) printf("I %d\n", r.intInclusive(0,999999)); }
    { Rng r = at("rolls"); for (int i=0;i<10;++i) printf("R %d\n", r.roll(2,6)); }
    { Rng r = at("rolls"); for (int i=0;i<10;++i) printf("R %d\n", r.roll(1,20)); }
    { Rng r = at("rolls"); for (int i=0;i<6;++i) printf("R %d\n", r.roll(3,8)); }
    return 0;
}
