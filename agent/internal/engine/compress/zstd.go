package compress

import (
	"fmt"

	"github.com/klauspost/compress/zstd"
)

type zstdCompressor struct {
	encoder *zstd.Encoder
	decoder *zstd.Decoder
}

func newZstdCompressor() (*zstdCompressor, error) {
	enc, err := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedDefault))
	if err != nil {
		return nil, fmt.Errorf("creating zstd encoder: %w", err)
	}
	dec, err := zstd.NewReader(nil)
	if err != nil {
		return nil, fmt.Errorf("creating zstd decoder: %w", err)
	}
	return &zstdCompressor{encoder: enc, decoder: dec}, nil
}

func (c *zstdCompressor) Compress(data []byte) ([]byte, error) {
	return c.encoder.EncodeAll(data, make([]byte, 0, len(data))), nil
}

func (c *zstdCompressor) Decompress(data []byte, originalSize int) ([]byte, error) {
	result, err := c.decoder.DecodeAll(data, make([]byte, 0, originalSize))
	if err != nil {
		return nil, fmt.Errorf("zstd decompress: %w", err)
	}
	return result, nil
}

func (c *zstdCompressor) Algorithm() Algorithm {
	return Zstd
}
