// Package compress provides pluggable compression for chunk transfers.
package compress

import "fmt"

// Algorithm identifies a compression algorithm.
type Algorithm uint8

const (
	None Algorithm = 0
	Zstd Algorithm = 1
	LZ4  Algorithm = 2
)

// String returns the algorithm name.
func (a Algorithm) String() string {
	switch a {
	case None:
		return "none"
	case Zstd:
		return "zstd"
	case LZ4:
		return "lz4"
	default:
		return fmt.Sprintf("unknown(%d)", a)
	}
}

// ParseAlgorithm parses a string to Algorithm.
func ParseAlgorithm(s string) (Algorithm, error) {
	switch s {
	case "none", "":
		return None, nil
	case "zstd":
		return Zstd, nil
	case "lz4":
		return LZ4, nil
	default:
		return None, fmt.Errorf("unknown compression algorithm: %s", s)
	}
}

// Compressor compresses and decompresses data.
type Compressor interface {
	Compress(data []byte) ([]byte, error)
	Decompress(data []byte, originalSize int) ([]byte, error)
	Algorithm() Algorithm
}

// New creates a Compressor for the given algorithm.
func New(algo Algorithm) (Compressor, error) {
	switch algo {
	case None:
		return &noneCompressor{}, nil
	case Zstd:
		return newZstdCompressor()
	case LZ4:
		return &lz4Compressor{}, nil
	default:
		return nil, fmt.Errorf("unsupported compression algorithm: %d", algo)
	}
}
