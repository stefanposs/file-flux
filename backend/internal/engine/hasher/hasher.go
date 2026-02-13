// Package hasher provides SHA-256 hashing utilities for transfer integrity.
package hasher

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
)

// Hash computes a SHA-256 hash and returns the raw 32-byte array.
func Hash(data []byte) [32]byte {
	return sha256.Sum256(data)
}

// HashReader reads all data from r and returns the SHA-256 hash.
func HashReader(r io.Reader) ([32]byte, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return [32]byte{}, fmt.Errorf("hashing reader: %w", err)
	}
	var result [32]byte
	copy(result[:], h.Sum(nil))
	return result, nil
}

// Verify checks that data matches the expected hash.
func Verify(data []byte, expected [32]byte) bool {
	actual := sha256.Sum256(data)
	return actual == expected
}

// VerifyReader reads all data from r and checks against the expected hash.
func VerifyReader(r io.Reader, expected [32]byte) (bool, error) {
	actual, err := HashReader(r)
	if err != nil {
		return false, err
	}
	return actual == expected, nil
}

// HexString converts a 32-byte hash to a hex string.
func HexString(h [32]byte) string {
	return hex.EncodeToString(h[:])
}

// FromHexString parses a hex string into a 32-byte hash.
func FromHexString(s string) ([32]byte, error) {
	var result [32]byte
	b, err := hex.DecodeString(s)
	if err != nil {
		return result, fmt.Errorf("invalid hex string: %w", err)
	}
	if len(b) != 32 {
		return result, fmt.Errorf("expected 32 bytes, got %d", len(b))
	}
	copy(result[:], b)
	return result, nil
}
