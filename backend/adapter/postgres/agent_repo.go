package postgres

import (
	"context"
	"database/sql"

	"github.com/stefanposs/file-flux/backend/domain/agent"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// AgentRepo implementiert agent.Repository mit PostgreSQL.
type AgentRepo struct {
	db *sql.DB
}

// NewAgentRepo erstellt ein neues AgentRepo.
func NewAgentRepo(pgdb *DB) *AgentRepo {
	return &AgentRepo{db: pgdb.Pool}
}

var _ agent.Repository = (*AgentRepo)(nil)

func (r *AgentRepo) List(ctx context.Context) ([]agent.Agent, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, type, status, ip_address, system, version, last_seen, description, created_at
		FROM agents ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var agents []agent.Agent
	for rows.Next() {
		var a agent.Agent
		err := rows.Scan(
			&a.ID, &a.Name, &a.Type, &a.Status,
			&a.IPAddress, &a.System, &a.Version,
			&a.LastSeen, &a.Description, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		agents = append(agents, a)
	}
	return agents, rows.Err()
}

func (r *AgentRepo) GetByID(ctx context.Context, id int) (*agent.Agent, error) {
	var a agent.Agent
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, type, status, ip_address, system, version, last_seen, description, created_at
		FROM agents WHERE id = $1
	`, id).Scan(
		&a.ID, &a.Name, &a.Type, &a.Status,
		&a.IPAddress, &a.System, &a.Version,
		&a.LastSeen, &a.Description, &a.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, common.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (r *AgentRepo) Create(ctx context.Context, a *agent.Agent) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO agents (name, type, status, description)
		VALUES ($1, $2, $3, $4) RETURNING id, created_at
	`, a.Name, a.Type, a.Status, a.Description).Scan(&a.ID, &a.CreatedAt)
}

func (r *AgentRepo) Update(ctx context.Context, a *agent.Agent) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE agents SET name = $1, type = $2, status = $3, description = $4
		WHERE id = $5
	`, a.Name, a.Type, a.Status, a.Description, a.ID)
	return err
}

func (r *AgentRepo) UpdateInfo(ctx context.Context, id int, system, ipAddress, version string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE agents SET system = $1, ip_address = $2, version = $3, last_seen = NOW()
		WHERE id = $4
	`, system, ipAddress, version, id)
	return err
}

func (r *AgentRepo) UpdateStatus(ctx context.Context, id int, status string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE agents SET status = $1, last_seen = NOW() WHERE id = $2
	`, status, id)
	return err
}

func (r *AgentRepo) Delete(ctx context.Context, id int) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM agents WHERE id = $1`, id)
	return err
}
