package compress

import (
	"bytes"
	"fmt"
	"io"

	"github.com/pierrec/lz4/v4"
)

type lz4Compressor struct{}

func (c *lz4Compressor) Compress(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := lz4.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		return nil, fmt.Errorf("lz4 compress write: %w", err)
	}
	if err := w.Close(); err != nil {
		return nil, fmt.Errorf("lz4 compress close: %w", err)
	}
	return buf.Bytes(), nil
}

func (c *lz4Compressor) Decompress(data []byte, originalSize int) ([]byte, error) {
	r := lz4.NewReader(bytes.NewReader(data))
	result, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("lz4 decompress: %w", err)
	}
	return result, nil
}

func (c *lz4Compressor) Algorithm() Algorithm {
	return LZ4
}
