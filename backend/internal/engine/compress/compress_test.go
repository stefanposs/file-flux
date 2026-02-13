package compress

import (
	"bytes"
	"crypto/rand"
	"testing"
)

func TestCompressRoundtripAll(t *testing.T) {
	data := make([]byte, 1024*1024) // 1 MB
	if _, err := rand.Read(data); err != nil {
		t.Fatal(err)
	}

	algos := []Algorithm{None, Zstd, LZ4}
	for _, algo := range algos {
		t.Run(algo.String(), func(t *testing.T) {
			comp, err := New(algo)
			if err != nil {
				t.Fatal(err)
			}

			compressed, err := comp.Compress(data)
			if err != nil {
				t.Fatal(err)
			}

			decompressed, err := comp.Decompress(compressed, len(data))
			if err != nil {
				t.Fatal(err)
			}

			if !bytes.Equal(data, decompressed) {
				t.Fatalf("roundtrip mismatch for %s", algo)
			}

			if algo != None && len(compressed) >= len(data) {
				t.Logf("warning: %s did not compress random data (expected for random)", algo)
			}
		})
	}
}

func TestCompressEmpty(t *testing.T) {
	algos := []Algorithm{None, Zstd, LZ4}
	for _, algo := range algos {
		t.Run(algo.String(), func(t *testing.T) {
			comp, err := New(algo)
			if err != nil {
				t.Fatal(err)
			}

			compressed, err := comp.Compress([]byte{})
			if err != nil {
				t.Fatal(err)
			}

			decompressed, err := comp.Decompress(compressed, 0)
			if err != nil {
				t.Fatal(err)
			}

			if len(decompressed) != 0 {
				t.Fatalf("expected empty, got %d bytes", len(decompressed))
			}
		})
	}
}

func TestParseAlgorithm(t *testing.T) {
	tests := []struct {
		input string
		want  Algorithm
		err   bool
	}{
		{"none", None, false},
		{"", None, false},
		{"zstd", Zstd, false},
		{"lz4", LZ4, false},
		{"invalid", None, true},
	}

	for _, tt := range tests {
		got, err := ParseAlgorithm(tt.input)
		if tt.err && err == nil {
			t.Errorf("ParseAlgorithm(%q) expected error", tt.input)
		}
		if !tt.err && err != nil {
			t.Errorf("ParseAlgorithm(%q) unexpected error: %v", tt.input, err)
		}
		if got != tt.want {
			t.Errorf("ParseAlgorithm(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}
