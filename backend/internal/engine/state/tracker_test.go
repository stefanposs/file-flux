package state

import (
	"testing"
	"time"
)

func TestTrackerLifecycle(t *testing.T) {
	tr := NewTracker()

	err := tr.Start(1, 5, [32]byte{}, TransferOpts{
		Phase:     PhaseUpload,
		ChunkSize: 8 * 1024 * 1024,
	})
	if err != nil {
		t.Fatal(err)
	}

	if tr.ActiveCount() != 1 {
		t.Fatalf("expected 1 active, got %d", tr.ActiveCount())
	}

	// Duplicate start should fail
	err = tr.Start(1, 5, [32]byte{}, TransferOpts{})
	if err == nil {
		t.Fatal("expected error for duplicate start")
	}

	// Mark some chunks
	tr.MarkChunkComplete(1, 0, 1000)
	tr.MarkChunkComplete(1, 1, 1000)
	tr.MarkChunkComplete(1, 2, 1000)

	if tr.IsComplete(1) {
		t.Fatal("should not be complete with 3/5 chunks")
	}

	c, total, bytes := tr.GetProgress(1)
	if c != 3 || total != 5 || bytes != 3000 {
		t.Fatalf("progress: %d/%d, %d bytes", c, total, bytes)
	}

	missing := tr.GetMissingChunks(1)
	if len(missing) != 2 {
		t.Fatalf("expected 2 missing, got %d", len(missing))
	}

	tr.MarkChunkComplete(1, 3, 1000)
	tr.MarkChunkComplete(1, 4, 1000)

	if !tr.IsComplete(1) {
		t.Fatal("should be complete with 5/5 chunks")
	}

	tr.Remove(1)
	if tr.ActiveCount() != 0 {
		t.Fatalf("expected 0 active after remove, got %d", tr.ActiveCount())
	}
}

func TestTrackerStale(t *testing.T) {
	tr := NewTracker()
	tr.Start(1, 1, [32]byte{}, TransferOpts{Phase: PhaseUpload})

	// With 0 duration, everything is stale
	stale := tr.StaleTransfers(0)
	if len(stale) != 1 {
		t.Fatalf("expected 1 stale, got %d", len(stale))
	}

	// With large duration, nothing is stale
	stale = tr.StaleTransfers(time.Hour)
	if len(stale) != 0 {
		t.Fatalf("expected 0 stale, got %d", len(stale))
	}
}

func TestTrackerNonExistent(t *testing.T) {
	tr := NewTracker()

	if tr.IsComplete(999) {
		t.Fatal("non-existent should not be complete")
	}

	err := tr.MarkChunkComplete(999, 0, 100)
	if err == nil {
		t.Fatal("expected error for non-existent transfer")
	}

	_, err = tr.GetState(999)
	if err == nil {
		t.Fatal("expected error for non-existent state")
	}
}
