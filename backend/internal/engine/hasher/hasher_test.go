package hasher

import (
	"bytes"
	"testing"
)

func TestHashAndVerify(t *testing.T) {
	data := []byte("hello world")
	h := Hash(data)
	if !Verify(data, h) {
		t.Fatal("verify failed for matching data")
	}
	if Verify([]byte("wrong"), h) {
		t.Fatal("verify should fail for different data")
	}
}

func TestHashReader(t *testing.T) {
	data := []byte("test data for hashing")
	h1 := Hash(data)
	h2, err := HashReader(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if h1 != h2 {
		t.Fatal("Hash and HashReader should produce same result")
	}
}

func TestHexRoundtrip(t *testing.T) {
	data := []byte("roundtrip test")
	h := Hash(data)
	s := HexString(h)
	h2, err := FromHexString(s)
	if err != nil {
		t.Fatal(err)
	}
	if h != h2 {
		t.Fatal("hex roundtrip mismatch")
	}
}

func TestFromHexStringInvalid(t *testing.T) {
	_, err := FromHexString("invalid")
	if err == nil {
		t.Fatal("expected error for invalid hex")
	}
	_, err = FromHexString("aabb")
	if err == nil {
		t.Fatal("expected error for short hex")
	}
}
