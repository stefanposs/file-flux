// Package compress provides pluggable compression for chunk transfers.
package compress

import "fmt"

type Algorithm uint8

const (
	None Algorithm = 0
	Zstd Algorithm = 1
	LZ4  Algorithm = 2
)

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

type Compressor interface {
	Compress(data []byte) ([]byte, error)
	Decompress(data []byte, originalSize int) ([]byte, error)
	Algorithm() Algorithm
}

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
