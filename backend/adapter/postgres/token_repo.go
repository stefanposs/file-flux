package postgres

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/token"
)

// TokenRepo implementiert token.Repository mit PostgreSQL.
type TokenRepo struct {
	db *sql.DB
}

// NewTokenRepo erstellt ein neues TokenRepo.
func NewTokenRepo(pgdb *DB) *TokenRepo {
	return &TokenRepo{db: pgdb.Pool}
}

var _ token.Repository = (*TokenRepo)(nil)

func (r *TokenRepo) List(ctx context.Context) ([]token.Token, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, agent_id, name, token_value, created_at, expires_at, last_used, description
		FROM tokens ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []token.Token
	for rows.Next() {
		var t token.Token
		err := rows.Scan(
			&t.ID, &t.AgentID, &t.Name, &t.Value,
			&t.CreatedAt, &t.ExpiresAt, &t.LastUsed, &t.Description,
		)
		if err != nil {
			return nil, err
		}
		if len(t.Value) > 8 {
			t.Value = t.Value[:8] + "..."
		}
		tokens = append(tokens, t)
	}
	return tokens, rows.Err()
}

func (r *TokenRepo) Create(ctx context.Context, t *token.Token) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO tokens (agent_id, name, token_value, description, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, t.AgentID, t.Name, t.Value, t.Description, t.ExpiresAt).Scan(&t.ID, &t.CreatedAt)
}

func (r *TokenRepo) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM tokens WHERE id = $1`, id)
	return err
}

func (r *TokenRepo) Validate(ctx context.Context, tokenValue string) (int, error) {
	var agentID int
	var expiresAt *time.Time

	err := r.db.QueryRowContext(ctx, `
		SELECT agent_id, expires_at FROM tokens
		WHERE token_value = $1
	`, tokenValue).Scan(&agentID, &expiresAt)
	if err == sql.ErrNoRows {
		return 0, common.ErrUnauthorized
	}
	if err != nil {
		return 0, err
	}

	if expiresAt != nil && expiresAt.Before(time.Now()) {
		return 0, fmt.Errorf("token expired: %w", common.ErrUnauthorized)
	}

	_, _ = r.db.ExecContext(ctx, `UPDATE tokens SET last_used = NOW() WHERE token_value = $1`, tokenValue)

	return agentID, nil
}
