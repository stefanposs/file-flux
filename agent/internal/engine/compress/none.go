package compress

type noneCompressor struct{}

func (c *noneCompressor) Compress(data []byte) ([]byte, error) {
	out := make([]byte, len(data))
	copy(out, data)
	return out, nil
}

func (c *noneCompressor) Decompress(data []byte, originalSize int) ([]byte, error) {
	out := make([]byte, len(data))
	copy(out, data)
	return out, nil
}

func (c *noneCompressor) Algorithm() Algorithm {
	return None
}
